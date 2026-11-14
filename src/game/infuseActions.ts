/**
 * Elementalism's jobs (`infusion.ts`): infusing motes into a thing at an
 * enchanter's plinth, and sensing the swirls round you. The island does both
 * (`infuse_refusal`, `perform_infuse`, `sense_refusal`, `perform_sense`) in the
 * same words; this side offers them and says what they did.
 */
import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { ENCHANTERS_PLINTH } from './enchant';
import { ITEM_DEFS, itemDef, type Item } from './items';
import { PLACED_REACH, SUBTILES } from './limits';
import { MOTE_ELEMENTS, type MoteElement } from './motes';
import { capital } from './words';
import {
  activeInfusion, ELEMENTALISM_SKILL, INFUSE, INFUSE_MOTES, INFUSE_SAID, INFUSE_SECS, infusedSaid, infuseFits, infuseShare, SENSE, SENSE_EVERY,
  SENSE_LEARN, sensedSaid, senseRange, senseWaitSaid, type Infusion,
} from './infusion';

/** The motes a target names, as the menu sets it (`item`): a stack in the pack. */
const moteUid = (t: Target): number | undefined => (t as { item?: number }).item;
/** The element of a mote item: "fire" off "fire_mote". */
export const moteElement = (id: string): MoteElement | null => {
  const el = id.endsWith('_mote') ? id.slice(0, -'_mote'.length) : '';
  return (MOTE_ELEMENTS as readonly string[]).includes(el) ? (el as MoteElement) : null;
};
/** What an infusion target is called: its item's name, or its kind. The island's `infuse_name`. */
export const infuseName = (def: string): string => ITEM_DEFS[def]?.name ?? capital(def.replace(/_/g, ' '));

/** A thing an infusion may go into: in the pack, or standing where it was set down. */
export type InfuseInto = { item: Item } | { placed: { thing: { infuse?: Infusion }; def: string; at: [number, number] } };

/** What a target is, standing: anything a scroll goes into, and a campfire. */
function standing(g: Game, t: Target): { thing: { infuse?: Infusion }; def: string; at: [number, number] } | undefined {
  if (t.kind === 'campfire') {
    const c = g.campfires.get(t.id);
    return c && { thing: c, def: 'campfire', at: [c.x + (c.sx + 1) / SUBTILES, c.y + (c.sy + 1) / SUBTILES] };
  }
  const p = g.placedFor(t);
  return p && { thing: p.thing as { infuse?: Infusion }, def: p.def, at: p.at };
}

/** Why these motes will not go into this thing, or what they are going into. The island's `infuse_refusal`, word for word. */
export function infuseSetting(g: Game, t: Target): { why: string } | { mote: Item; el: MoteElement; into: InfuseInto } {
  const uid = moteUid(t);
  const mote = uid !== undefined ? g.inventory.get(uid) : undefined;
  const el = mote ? moteElement(mote.id) : null;
  if (!mote || !el || mote.count < INFUSE_MOTES) return { why: INFUSE_SAID.motes };
  if (!g.atStation(ENCHANTERS_PLINTH)) return { why: INFUSE_SAID.plinth };
  if (t.kind === 'item') {
    const it = g.inventory.get(t.uid);
    if (!it) return { why: INFUSE_SAID.gone };
    if (!infuseFits(el, it.id)) return { why: INFUSE_SAID.fits(el) };
    const was = activeInfusion(it);
    if (was) return { why: INFUSE_SAID.already(was.el) };
    return { mote, el, into: { item: it } };
  }
  const p = standing(g, t);
  if (!p) return { why: INFUSE_SAID.gone };
  if (Math.hypot(p.at[0] - g.player.x, p.at[1] - g.player.y) > PLACED_REACH) return { why: INFUSE_SAID.reach };
  if (!infuseFits(el, p.def)) return { why: INFUSE_SAID.fits(el) };
  const was = activeInfusion(p.thing);
  if (was) return { why: INFUSE_SAID.already(was.el) };
  return { mote, el, into: { placed: p } };
}

/** The things in the pack and standing within reach that motes of this element go into, for the mote's menu. */
export function infusable(g: Game, el: MoteElement): Array<{ label: string; target: Target }> {
  const out: Array<{ label: string; target: Target }> = [];
  for (const it of g.inventory.items) if (infuseFits(el, it.id)) out.push({ label: itemDef(it.id).name, target: { kind: 'item', uid: it.uid } as Target });
  for (const { target, placed } of g.placedNear()) if (infuseFits(el, placed.def)) out.push({ label: placed.name, target });
  for (const c of g.campfires.values()) {
    if (!infuseFits(el, 'campfire')) break;
    if (Math.hypot(c.x + (c.sx + 1) / SUBTILES - g.player.x, c.y + (c.sy + 1) / SUBTILES - g.player.y) <= PLACED_REACH) {
      out.push({ label: infuseName('campfire'), target: { kind: 'campfire', id: c.id } as Target });
    }
  }
  return out;
}

/** Seconds before a sensing may be done again; nought when it may. */
export const senseWait = (g: Game): number => Math.max(0, g.sensedAt + SENSE_EVERY - Date.now() / 1000);

export const INFUSE_ACTIONS: ActionDef[] = [
  {
    id: INFUSE,
    label: 'Infuse',
    verb: 'infusing',
    skill: ELEMENTALISM_SKILL,
    hidden: true,
    stamina: 0.04,
    baseTime: 12,
    applies: (t) => moteUid(t) !== undefined,
    check: (t, g) => {
      const s = infuseSetting(g, t);
      return 'why' in s ? s.why : null;
    },
    perform: (t, g) => {
      const s = infuseSetting(g, t);
      if ('why' in s) return;
      const share = infuseShare(g.skills.get(ELEMENTALISM_SKILL), s.mote.ql, g.attuned === s.el);
      const i: Infusion = { el: s.el, str: share, until: Date.now() / 1000 + INFUSE_SECS };
      g.inventory.remove(s.mote.uid, INFUSE_MOTES);
      const def = 'item' in s.into ? s.into.item.id : s.into.placed.def;
      if ('item' in s.into) s.into.item.infuse = i;
      else s.into.placed.thing.infuse = i;
      g.gainSkill(ELEMENTALISM_SKILL, 1);
      g.logMsg(infusedSaid(infuseName(def), i), 'event');
      g.events.emit('inventory');
    },
  },
  {
    id: SENSE,
    label: 'Sense mote swirls',
    verb: 'sensing',
    skill: ELEMENTALISM_SKILL,
    stamina: 0.02,
    baseTime: 4,
    applies: (t) => t.kind === 'tile',
    check: (_t, g) => (senseWait(g) > 0 ? senseWaitSaid(senseWait(g)) : null),
    perform: (_t, g) => {
      const range = senseRange(g.skills.get(ELEMENTALISM_SKILL));
      const px = Math.floor(g.player.x), py = Math.floor(g.player.y);
      let n = 0;
      for (const s of g.swirls.values()) if (Math.hypot(s.x - px, s.y - py) <= range) n++;
      g.sensedAt = Date.now() / 1000;
      g.gainSkill(ELEMENTALISM_SKILL, SENSE_LEARN);
      g.logMsg(sensedSaid(n, range), 'event');
    },
  },
];
