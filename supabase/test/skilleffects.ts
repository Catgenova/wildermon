/**
 * The Skills window's sliders.
 *
 * Asked for: "For all skills in the skill window, display a slider for
 * anything affected by a skill", every skill at once, and "for skills that
 * begin at level 20, the slider base should begin as if the starting value is
 * level 1". Asked of the browser, on a body fresh ashore:
 *
 *   * every skill has a row of sliders, and each track runs from the skill's
 *     own starting value to the top;
 *   * every value reads as a value, and no slider is the same at both ends;
 *   * reading a slider leaves the skill where it was;
 *   * a slider says what the rule says: carry weight, time per action, the
 *     success chance and a weapon's blow, read off the rules directly.
 */
// The game first: `deed.ts` and `actions.ts` import each other through it, and the game is what loads them in order.
import { CARRY_BASE, CARRY_PER_STRENGTH, CHAR_START, Game, goSeconds } from '../../src/game/game';
import { SKILL_DEFS, SKILL_TOP } from '../../src/game/skills';
import { atLevel, effectsOf, effectTracks } from '../../src/game/skilleffects';
import { weaponDamage, WEAPONS } from '../../src/game/gear';
import { percent } from '../../src/game/words';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const g = Game.create(4242);
g.skills.values.set('mining', 37.5);

const none = SKILL_DEFS.filter((d) => !effectsOf(d.id).length).map((d) => d.id);
check('every skill has a row of sliders', !none.length, none.join(', '));

const wrongStart: string[] = [];
const unreadable: string[] = [];
const flat: string[] = [];
const moved: string[] = [];
for (const def of SKILL_DEFS) {
  const was = g.skills.standing(def.id);
  for (const t of effectTracks(g, def.id)) {
    if (t.from !== def.start || t.to !== SKILL_TOP) wrongStart.push(`${def.id} ${t.from}–${t.to}`);
    if ([t.low, t.now, t.high].some((v) => /NaN|undefined|Infinity/.test(v))) unreadable.push(`${def.id} ${t.label}: ${t.low} / ${t.now} / ${t.high}`);
    if (t.low === t.high) flat.push(`${def.id} ${t.label} ${t.low}`);
  }
  if (g.skills.standing(def.id) !== was) moved.push(`${def.id} ${was} → ${g.skills.standing(def.id)}`);
}
check('each track runs from the skill\'s own start to the top: 20 for a characteristic, 1 for the rest',
  !wrongStart.length && effectTracks(g, 'body_strength')[0].from === CHAR_START, wrongStart.slice(0, 4).join('; '));
check('every value reads as one', !unreadable.length, unreadable.slice(0, 4).join('; '));
check('no slider is the same at both ends', !flat.length, flat.slice(0, 6).join('; '));
check('reading the sliders leaves every skill where it was', !moved.length, moved.join('; '));

/* ---- the sliders say what the rules say ------------------------------------------ */

const carry = effectTracks(g, 'body_strength').find((t) => t.label === 'Carry weight')!;
check('carry weight at either end is the rule\'s, with nothing worn and no perks',
  carry.low === `${CARRY_BASE + CHAR_START * CARRY_PER_STRENGTH} kg` && carry.high === `${CARRY_BASE + SKILL_TOP * CARRY_PER_STRENGTH} kg`,
  `${carry.low} – ${carry.high}`);
const time = effectTracks(g, 'mining').find((t) => t.label === 'Time per action')!;
check('a trade\'s time per action is the rule\'s share of the time at level 0',
  time.high === `${percent(goSeconds(100, SKILL_TOP) / goSeconds(100, 0))} of level 0`, time.high);
const chance = effectTracks(g, 'mining').find((t) => t.label === 'Success chance')!;
check('and its success chance now is the rule\'s at the level it is at',
  chance.now === percent(g.skillChance('mining', 10, 0, g.mindEase())), `${chance.now} at mining 37.5`);
const sword = WEAPONS.find((w) => w.kind === 'swords')!;
const blow = effectTracks(g, 'swords').find((t) => t.label === 'Damage per blow')!;
check('a weapon skill\'s blow at the top is the weapon\'s at swords 100',
  blow.high === `${atLevel(g, 'swords', SKILL_TOP, () => weaponDamage(g, sword, null)).toFixed(1)} damage`, blow.high);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`the Skills window's sliders — ${ok.length} of ${ok.length}`);
