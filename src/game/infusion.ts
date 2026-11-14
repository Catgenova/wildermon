/**
 * Elementalism past the swirls (`motes.ts`): infusing motes into things at an
 * enchanter's plinth, attunement to the element you collect most, and sensing
 * the swirls round you.
 *
 * Infusing puts `INFUSE_MOTES` motes of one element, off one stack, into a
 * thing that element goes into (`INFUSE_INTO`): one element to a thing, for
 * `INFUSE_DAYS` days. Its share of the element's most (`InfuseDef.most`) is
 * (Elementalism ÷ 100) × (the motes' QL ÷ 100), ×(1 + `ATTUNE_STRENGTH`) for
 * the element you are attuned to (`infuseShare`), so an attuned infusion at
 * 100 and 100 gives ×1.2 of the most. Each infusion trains Elementalism a
 * full go.
 *
 * A leaf on purpose (it imports only the mote table's names), so the items,
 * the help, the skill pages and the defs dump can read it. The island plays
 * every rule (`infuse_*`, `mote_attuned`, `perform_sense` in the migrations).
 */
import { MOTE_ELEMENTS, type MoteElement } from './motes';
import { ARMOUR, SHIELDS, WEAPONS } from './gear';

/** The skill. */
export const ELEMENTALISM_SKILL = 'elementalism';

/** The job, at an enchanter's plinth. */
export const INFUSE = 'infuse_motes';
/** Motes an infusion takes, all of one element off one stack. */
export const INFUSE_MOTES = 3;
/** How long an infusion lasts, in days, and in real seconds. */
export const INFUSE_DAYS = 7;
export const INFUSE_SECS = INFUSE_DAYS * 24 * 3600;
/** What attunement adds to an infusion of its element, as a share of it. */
export const ATTUNE_STRENGTH = 0.2;
/** And to a swirl of its element collected, in motes. */
export const ATTUNE_MOTES = 1;
/** How far back attunement counts what you collected, in days. */
export const ATTUNE_DAYS = 7;

/** An infusion as a thing carries it: its element, its share of the element's most, and when it ends (epoch seconds). */
export interface Infusion {
  el: string;
  str: number;
  until: number;
}
/** Anything that may carry one: an item, a piece, a smelter. */
export type Infusable = { infuse?: Infusion | null } | null | undefined;

/** What one element goes into and what it does there, at its most. */
export interface InfuseDef {
  /** The things it goes into, by item or piece id (a campfire, a smelter and a kiln by their kind). */
  into: readonly string[];
  /** The most it does, at a share of one: a multiplier's part (fuel ×1.5 is 0.5) or a chance. */
  most: number;
  /** What it changes, as a label. */
  label: string;
  /** Its value at a share, as the game writes it. */
  say: (share: number) => string;
}

const pct = (v: number): string => `${Math.round(v * 1000) / 10}%`;
const times = (v: number): string => `×${Math.round(v * 100) / 100}`;

/**
 * Every element that goes into something, with what it does at its most.
 * Ice is not among them: nothing held in a larder, a barrel or a crate decays
 * (`rot.ts`), so there is nothing for it to slow.
 */
export const INFUSE_INTO: Partial<Record<MoteElement, InfuseDef>> = {
  fire: { into: ['campfire', 'oven', 'smelter', 'kiln'], most: 0.5, label: 'Fuel lasts', say: (s) => times(1 + 0.5 * s) },
  earth: { into: ['shovel', 'pickaxe'], most: 0.2, label: 'Digging and mining yield +1, chance', say: (s) => pct(0.2 * s) },
  wind: { into: ['sailing_boat', 'caravel', 'large_cart', 'wagon'], most: 0.08, label: 'Speed', say: (s) => `+${pct(0.08 * s)}` },
  water: { into: ['well'], most: 1, label: 'Fills', say: (s) => `${times(1 + s)} as fast` },
  life: { into: ['planter'], most: 0.25, label: 'Growth stage time', say: (s) => times(1 - 0.25 * s) },
  light: { into: ['lantern', 'lamp_post', 'lamp_pillar'], most: 1, label: 'Candle', say: () => 'not needed' },
  dark: { into: [], most: 0.1, label: 'Blows on the wearer or wielder: miss chance', say: (s) => `+${pct(0.1 * s)}` },
};
/** The fire element's fuel life at a share, the earth's chance of one more, wind's pace, water's fill, life's stage time, dark's miss. */
export const fireLife = (share: number): number => 1 + (INFUSE_INTO.fire?.most ?? 0) * share;
export const earthMore = (share: number): number => (INFUSE_INTO.earth?.most ?? 0) * share;
export const windPace = (share: number): number => 1 + (INFUSE_INTO.wind?.most ?? 0) * share;
export const waterFill = (share: number): number => 1 + (INFUSE_INTO.water?.most ?? 0) * share;
export const lifeStage = (share: number): number => 1 - (INFUSE_INTO.life?.most ?? 0) * share;
export const darkMiss = (share: number): number => (INFUSE_INTO.dark?.most ?? 0) * share;

/** Weapons, armour and shields, which dark goes into. */
export const darkInto = (): string[] => [...WEAPONS.map((w) => w.id), ...ARMOUR.map((a) => a.id), ...Object.keys(SHIELDS)];
/** Whether this element goes into a thing of this id. The island's `infuse_fits`. */
export const infuseFits = (el: string, id: string): boolean =>
  (el === 'dark' ? darkInto().includes(id) : !!INFUSE_INTO[el as MoteElement]?.into.includes(id));
/** The elements that go into anything. */
export const INFUSE_ELEMENTS: readonly MoteElement[] = MOTE_ELEMENTS.filter((e) => !!INFUSE_INTO[e]);

/** An infusion's share of its element's most, off the skill, the motes' QL and attunement. The island's `infuse_share`. */
export const infuseShare = (skill: number, moteQl: number, attuned: boolean): number =>
  (Math.max(0, Math.min(100, skill)) / 100) * (Math.max(0, Math.min(100, moteQl)) / 100) * (attuned ? 1 + ATTUNE_STRENGTH : 1);

/** A thing's infusion of this element now, as a share: nought for none, another element or one run out. The island's `infuse_on`. */
export const infusedShare = (thing: Infusable, el: MoteElement, nowSecs = Date.now() / 1000): number => {
  const i = thing?.infuse;
  return i && i.el === el && i.until > nowSecs ? i.str : 0;
};
/** A thing's infusion, while it lasts. */
export const activeInfusion = (thing: Infusable, nowSecs = Date.now() / 1000): Infusion | null =>
  (thing?.infuse && thing.infuse.until > nowSecs ? thing.infuse : null);

/** Time left, as the game writes it: "6 d 23 h", "4 h 10 min". */
const left = (secs: number): string => {
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60);
  return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${Math.max(1, m)} min`;
};
/** What an infusion says on a thing: "Infused: fire. Fuel lasts ×1.32. 6 d 23 h left." The island's `infuse_says`. */
export const infuseSays = (i: Infusion, nowSecs = Date.now() / 1000): string => {
  const def = INFUSE_INTO[i.el as MoteElement];
  return `Infused: ${i.el}, strength ${Math.round(i.str * 100)}%.${def ? ` ${def.label}: ${def.say(i.str)}.` : ''} ${left(i.until - nowSecs)} left.`;
};

/** What both sides say of an infusion that will not go. */
export const INFUSE_SAID = {
  motes: `Need ${INFUSE_MOTES} motes of one element.`,
  plinth: 'Stand at an enchanter\'s plinth.',
  gone: 'It is gone.',
  reach: 'Too far: stand within reach of it.',
  fits: (el: MoteElement): string => `${el[0].toUpperCase()}${el.slice(1)}: ${el === 'dark' ? 'goes into weapons, armour or shields only' : INFUSE_INTO[el]?.into.length ? `goes into ${INFUSE_INTO[el]?.into.join(', ').replace(/_/g, ' ')} only` : 'goes into nothing'}.`,
  already: (el: string): string => `Already infused: ${el}.`,
} as const;
/** What an infusion that went says. */
export const infusedSaid = (name: string, i: Infusion, nowSecs = Date.now() / 1000): string => `${name}: ${infuseSays(i, nowSecs)}`;

/* ---- sensing ----------------------------------------------------------------------- */

/** The job: once an hour, the swirls within reach marked on your map. */
export const SENSE = 'sense_swirls';
export const SENSE_EVERY = 3600;
export const SENSE_BASE = 20;
export const SENSE_PER_LEVEL = 0.8;
/** What a sensing teaches, as the base of a gain. */
export const SENSE_LEARN = 0.25;
/** How far a sensing reaches at a level, in tiles. The island's `sense_range`. */
export const senseRange = (skill: number): number => SENSE_BASE + SENSE_PER_LEVEL * Math.max(0, Math.min(100, skill));
/** Real seconds a sensing stays on the map. */
export const SENSE_SHOWN = 600;
/** How a sensing's word starts, for the map to take it up (`Game.write`). */
export const SENSED = 'Sensed:';
/** What a sensing says. The island's words too. */
export const sensedSaid = (n: number, range: number): string =>
  `${SENSED} ${n} mote swirl${n === 1 ? '' : 's'} within ${Math.round(range)} tiles. Marked on your map.`;
/** What a sensing too soon says. */
export const senseWaitSaid = (secs: number): string => `Sensed within the hour: again in ${Math.ceil(secs / 60)} min.`;
