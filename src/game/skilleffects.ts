import type { Game } from './game';
import { SKILL_BY_ID, SKILL_TOP } from './skills';

/**
 * What a skill's level changes, one entry per number, for the Skills window's
 * sliders.
 *
 * Every value is read off the rule itself (`atLevel`): the skill is set to the
 * level asked about, the rule the game plays by is asked, and the skill is put
 * back. Nothing here restates a formula, so a slider cannot drift from the
 * rule it shows, and what you carry and the perks you hold count as they do in
 * play.
 */
export interface SkillEffect {
  /** What it changes, in the game's terms: "Carry weight", "Boat row speed". */
  label: string;
  /** Its value now, as the rule reads it, with the skill at whatever level `atLevel` has set. */
  at: (g: Game) => number;
  /** The value as the game writes it. */
  say: (v: number) => string;
  /** What else it depends on, when the rule needs more than the level: "Difficulty 20". */
  note?: string;
}

/** A rule read with one skill at another level, and the skill put back however the rule returns. */
export function atLevel<T>(g: Game, id: string, level: number, read: () => T): T {
  const had = g.skills.values.get(id);
  g.skills.values.set(id, level);
  try {
    return read();
  } finally {
    if (had === undefined) g.skills.values.delete(id);
    else g.skills.values.set(id, had);
  }
}

/** One effect laid out along its track: the skill's starting value at the left, `SKILL_TOP` at the right. */
export interface EffectTrack {
  label: string;
  note?: string;
  /** The level the track starts at (the skill's own starting value) and ends at. */
  from: number;
  to: number;
  /** Where your level stands along it, 0 to 1. */
  share: number;
  low: string;
  now: string;
  high: string;
}

/** Every effect of a skill, along its track, for this body. */
export function effectTracks(g: Game, id: string): EffectTrack[] {
  const def = SKILL_BY_ID.get(id);
  const effects = SKILL_EFFECTS[id] ?? [];
  if (!def || !effects.length) return [];
  const from = def.start;
  const to = SKILL_TOP;
  const level = Math.min(to, Math.max(from, g.skills.get(id)));
  return effects.map((e) => ({
    label: e.label,
    note: e.note,
    from,
    to,
    share: to > from ? (level - from) / (to - from) : 1,
    low: e.say(atLevel(g, id, from, () => e.at(g))),
    now: e.say(e.at(g)),
    high: e.say(atLevel(g, id, to, () => e.at(g))),
  }));
}

/** What each skill changes, by its id. A skill with nothing here has no row of sliders. */
export const SKILL_EFFECTS: Record<string, SkillEffect[]> = {};
