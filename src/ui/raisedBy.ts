import { SWING_BODY } from '../game/creatureActions';
import { DODGE_GAIN } from '../game/fight';
import {
  DARK_HIT, DARK_SHOT, DARK_SWING, DARK_WALK, DARK_WORK, HEAVY_SKILLS, MIND_GAIN, NIGHT_EYES_FROM, SOUL_GAIN, TRY_LEARN,
  TRACK_AWARE, WORK_BACK, WORK_HAND, WORK_WIND, WORK_WIND_SPENT,
} from '../game/learn';
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
    { what: `action in ${listed([...HEAVY_SKILLS].map(skillName))}`, base: WORK_BACK },
    { what: 'melee swing', base: SWING_BODY, tried: true },
  ],
  body_stamina: [
    { what: 'action that costs stamina', base: WORK_WIND, more: `+${percent(WORK_WIND_SPENT)} of an action's gain per full stamina bar spent, proportional` },
    { what: 'Sleep in a bed', how: 'more in a better bed' },
  ],
  body_control: [
    { what: 'action with a stamina cost or a time', base: WORK_HAND },
    { what: 'blow dodged', base: DODGE_GAIN },
  ],
  // One gain for all of them (`MIND_GAIN`): CRAFT_HEAD, RESTORE_GAIN, TAME_HEAD, ENCHANT_HEAD, PROSPECT_HEAD, HOARD_HEAD.
  mind_logic: [
    { what: 'craft, find restored, taming offering, scroll set', base: MIND_GAIN, tried: true },
    { what: 'prospecting action, treasure hoard dug up', base: MIND_GAIN },
    { what: 'study action at a plain book', how: 'see Reeds, papyrus and books' },
  ],
  // One gain for all of them (`SOUL_GAIN`): TAME_NERVE, and a prayer's, a sitting's and a sacrifice's.
  soul_strength: [
    { what: 'offering to a wild wildermon', base: SOUL_GAIN, tried: true },
    { what: 'prayer, sitting, sacrifice at an altar', base: SOUL_GAIN },
  ],
  awareness: [
    { what: 'swing in the dark', base: DARK_SWING },
    { what: 'shot in the dark', base: DARK_SHOT },
    { what: 'blow taken in the dark', base: DARK_HIT },
    { what: 'tile walked in the dark', base: DARK_WALK },
    { what: 'forage or fishing action in the dark', base: DARK_WORK },
    { what: `each scaled by darkness; none until over ${percent(NIGHT_EYES_FROM)} dark or underground` },
    { what: 'tracking action, any hour', base: TRACK_AWARE },
  ],
};

/** One way a characteristic is raised, as a label: "craft: 25% of a go (30% of that on failure)". */
export function raiseSays(r: Raise): string {
  let said = r.what;
  if (r.base !== undefined) said += `: ${percent(r.base / KNACK_GO)} of an action's gain`;
  if (r.more) said += ` ${r.more}`;
  if (r.tried) said += ` (${percent(TRY_LEARN)} of that on failure)`;
  if (r.how) said += ` (${r.how})`;
  return said;
}

/** Everything that raises this characteristic, each way apart by a semicolon; empty for a skill that is not one. */
export const raisedBySays = (id: string): string => (RAISED_BY[id] ?? []).map(raiseSays).join('; ');
