import { RESTORE_GAIN } from '../game/archaeology';
import { SWING_BODY, TAME_NERVE } from '../game/creatureActions';
import { DODGE_GAIN } from '../game/fight';
import {
  DARK_HIT, DARK_SHOT, DARK_SWING, ENCHANT_HEAD, HEAVY_SKILLS, HOARD_HEAD, NIGHT_EYES_FROM, PROSPECT_HEAD, TAME_HEAD, TRY_LEARN,
  WORK_BACK, WORK_HAND, WORK_WIND, WORK_WIND_SPENT,
} from '../game/learn';
import { CRAFT_HEAD } from '../game/recipes';
import { SKILL_BY_ID } from '../game/skills';
import { KNACK_GO } from '../game/titles';
import { listed, percent } from '../game/words';

/**
 * What raises each characteristic, and by how much a go: the help's table of
 * characteristics and the Skills window's notes are both read off this, and
 * each amount off the constant the rule itself gains by, so neither can name
 * a job that teaches nothing or leave out one that does.
 *
 * `base` is the share of a go (`KNACK_GO`, what a go at a trade that comes
 * off teaches the trade); `tried` says a go that did not come off pays
 * `TRY_LEARN` of it, as `tryGain` does; `more` is what is added to the
 * amount, and `how` stands in for an amount the help gives elsewhere.
 */
export interface Raise {
  what: string;
  base?: number;
  tried?: boolean;
  more?: string;
  how?: string;
}

const skillName = (id: string): string => (SKILL_BY_ID.get(id)?.name ?? id).toLowerCase();

export const RAISED_BY: Readonly<Record<string, readonly Raise[]>> = {
  body_strength: [
    { what: `go at ${listed([...HEAVY_SKILLS].map(skillName))}`, base: WORK_BACK },
    { what: 'melee swing', base: SWING_BODY, tried: true },
  ],
  body_stamina: [
    { what: 'go that costs stamina', base: WORK_WIND, more: `+${percent(WORK_WIND_SPENT)} of a go per full stamina bar spent, proportional` },
    { what: 'night of sleep', how: 'more in a better bed' },
  ],
  body_control: [
    { what: 'go of work (any job with a stamina cost or a time)', base: WORK_HAND },
    { what: 'blow dodged', base: DODGE_GAIN },
  ],
  mind_logic: [
    { what: 'craft', base: CRAFT_HEAD, tried: true },
    { what: 'find restored', base: RESTORE_GAIN, tried: true },
    { what: 'go of prospecting', base: PROSPECT_HEAD },
    { what: 'offering to a wild creature', base: TAME_HEAD, tried: true },
    { what: 'scroll set into a weapon or placed thing', base: ENCHANT_HEAD, tried: true },
    { what: 'treasure map hoard dug up', base: HOARD_HEAD },
    { what: 'go of study at a plain book', how: 'see Reeds, papyrus and books' },
  ],
  soul_strength: [
    { what: 'offering to a wild creature', base: TAME_NERVE, tried: true },
  ],
  awareness: [
    { what: 'swing in the dark', base: DARK_SWING },
    { what: 'shot in the dark', base: DARK_SHOT },
    { what: 'blow taken in the dark', base: DARK_HIT },
    { what: `each scaled by darkness; none until over ${percent(NIGHT_EYES_FROM)} dark or underground` },
  ],
};

/** One way a characteristic is raised, as a label: "craft: 25% of a go (30% of that on failure)". */
export function raiseSays(r: Raise): string {
  let said = r.what;
  if (r.base !== undefined) said += `: ${percent(r.base / KNACK_GO)} of a go`;
  if (r.more) said += ` ${r.more}`;
  if (r.tried) said += ` (${percent(TRY_LEARN)} of that on failure)`;
  if (r.how) said += ` (${r.how})`;
  return said;
}

/** Everything that raises this characteristic, each way apart by a semicolon; empty for a skill that is not one. */
export const raisedBySays = (id: string): string => (RAISED_BY[id] ?? []).map(raiseSays).join('; ');
