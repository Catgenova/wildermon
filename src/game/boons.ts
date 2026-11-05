import { ITEM_DEFS, itemDef } from './items';
import { SKILL_DEFS } from './skills';
import { world } from './pace';

/**
 * What makes the work go into you faster than it otherwise would, besides the
 * sleep bonus (`sleep.ts`): a **knack**. Only a dish off a shut recipe
 * (`Recipe.locked`, read from a Recipe) carries one, for the skills written on
 * it (`ItemDef.knackSkills`), and eating it leaves those skills going in faster
 * for a while. Plain food, brews, spirits and tinctures carry none. This is the
 * same idea as the knack a long day at a trade leaves behind, except that this
 * one wears off.
 */
export interface Boon {
  /** Skill it lifts. */
  skill: string;
  /** Added to the rate that skill goes in at: 0.25 is a quarter again. */
  bonus: number;
  /** Game time it runs out at. */
  until: number;
  /** What gave it, for the hud. */
  from: string;
  /** A tincture's, from before tinctures stopped giving one: left to run out. Absent on a dish's. */
  kind?: 'tincture';
}

/** What a dish's knack is worth, and how long the best of them carries it. */
export const BOON_BONUS = 0.5;
export const BOON_SECONDS = world(20 * 60);

/**
 * What a Naturalist's tincture gave while it gave a knack: their own four
 * trades, a tenth again, for twenty minutes. It gives none now; the numbers are
 * kept for What's new, which says what it was.
 */
export const TINCTURE_SKILLS = ['foraging', 'botanizing', 'alchemy', 'first_aid'];
export const TINCTURE_BONUS = 0.1;
export const TINCTURE_SECONDS = world(20 * 60);

/** The skills a dish's knack may name: the ones you work at, not the ones you are. The island's `boon_skill`. */
export const BOON_SKILLS: string[] = SKILL_DEFS.filter((d) => d.group !== 'Characteristics').map((d) => d.id);

/** The skills a helping of a thing raises the skill gain of: a dish off a shut recipe's own, none for anything else. */
export const knacksOf = (itemId: string): string[] => ITEM_DEFS[itemId]?.knackSkills ?? [];

/** Everything that carries a knack. */
export const BOON_FOODS: string[] = Object.keys(ITEM_DEFS).filter((id) => knacksOf(id).length > 0);

/** A skill's name, lower case: what a meal boost names. */
export const skillWord = (id: string): string => (SKILL_DEFS.find((d) => d.id === id)?.name ?? id).toLowerCase();

/** What a helping's meal boost is, as a label: "Meal boost: butchering skill gain +50%". The island's `knack_says`. */
export const knackSays = (itemId: string): string => {
  const skills = knacksOf(itemId);
  return skills.length ? `Meal boost: ${skills.map(skillWord).join(', ')} skill gain +${Math.round(BOON_BONUS * 100)}%` : '';
};

/**
 * How long a helping of it holds, by how good a helping it was, and past the
 * ceiling its food and drink have: a spirit's own (`knack` on the thing) and
 * its maker's (`knack`, a Cook's Flavoursome or Strong Brew, on the helping).
 */
export const boonTime = (itemId: string, ql: number, knack = 1): number => {
  const def = itemDef(itemId);
  // Something brewed sits with you far longer than something eaten.
  const body = (def.food ?? 0) + (def.drink ?? 0) * 2.4;
  return Math.round(BOON_SECONDS * Math.min(2.5, body * 2.2) * (0.4 + Math.min(100, ql) / 140) * (def.knack ?? 1) * knack);
};

/** Minutes and seconds, the way a clock would put it. */
export function clockLeft(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m >= 1 ? `${m}m` : `${s}s`;
}

/**
 * A stretch of time in figures, as a label says it: "45 s", "25 min", "1 h 35 min", "6 h". Seconds under two
 * minutes, minutes under an hour, and hours and minutes past that. Asked for: digits, not number words, for every
 * count and quantity.
 */
export function durationSaid(seconds: number): string {
  if (seconds < 120) return `${Number(seconds.toFixed(1))} s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/*
 * Every dish with a knack says it in its description, from the rule: what it
 * lifts and how long, at the worst helping and the best. The island's
 * `item_def.description` is dumped from the same text.
 */
for (const id of BOON_FOODS) {
  const d = ITEM_DEFS[id];
  const knack = `${knackSays(id)}, ${durationSaid(boonTime(id, 1))} (QL 1) to ${durationSaid(boonTime(id, 100))} (QL 100).`;
  d.description = d.description ? `${d.description} ${knack}` : knack;
}
