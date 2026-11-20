/**
 * Every skill with a gate has something open at its start (`SkillDef.start`): a gate in it at or under that level (a
 * recipe by `recipeLevel`, a sprout, an ore smelted, a casting worked, a relic), or the skill is in
 * `TRAINED_ELSEWHERE`, named with the open action that trains it.
 *
 * Reported: a new body could not chisel stone bricks (Guiding Light, Stone bricks) at stonecutting 1, and nothing
 * else trained stonecutting: its lowest recipe was the whetstone at 5, the kit's whetstone and quern cannot be
 * improved. Milling (flour at 5) and glassblowing (glass at 5) were the same. Then the sweep: restoration (only
 * restoring trains it; the old pot was 10) and enchanting (only a scroll trains it; every Formula was 20 or more).
 *
 *   npx esbuild supabase/test/firststeps.ts --bundle --platform=node --format=esm --loader:.png=dataurl \
 *     --outfile=node_modules/.cache/firststeps.mjs && node node_modules/.cache/firststeps.mjs
 */
import { RECIPES } from '../../src/game/recipes';
import { FIRST_FORMULA, FIRST_RELIC } from '../../src/game/craftgates';
import { SKILL_DEFS } from '../../src/game/skills';
import { gateOf, SKILL_GATES } from '../../src/game/skillgates';
import { ACTION_BY_ID } from '../../src/game/actions';
import { check, finish } from './harness';

/** Skills whose every gate is past their start, and the action that trains them before it (none: driving a cart). */
const TRAINED_ELSEWHERE: Readonly<Record<string, string | null>> = {
  brewing: 'start_brew',
  repair: 'repair_item',
  botanizing: 'botanize',
  paving: 'pack',
  driving: null,
};

const lowest = (skill: string): number => Math.min(...SKILL_GATES.filter((g) => g.skill === skill).map((g) => g.level));
const shut: string[] = [];
for (const s of SKILL_DEFS) {
  if (!SKILL_GATES.some((g) => g.skill === s.id)) continue;
  if (lowest(s.id) > s.start && !(s.id in TRAINED_ELSEWHERE)) shut.push(`${s.id} ${s.start}: lowest gate ${lowest(s.id)}`);
}
check('every gated skill has something open at its start, or is trained by something open', shut.length === 0, shut.join('; '));
for (const s of Object.keys(TRAINED_ELSEWHERE)) {
  const start = SKILL_DEFS.find((d) => d.id === s)!.start;
  check(`${s}: still has nothing open at its start (else take it off the list)`, lowest(s) > start, `lowest ${lowest(s)}`);
  const by = TRAINED_ELSEWHERE[s];
  if (by) check(`${s}: trained by ${by}`, ACTION_BY_ID.get(by)?.skill === s, ACTION_BY_ID.get(by)?.skill);
}
check('stone brick, flour and glass open at 1, the Guiding Light\'s Stone bricks step at a new body\'s stonecutting',
  ['make_stone_brick', 'make_flour', 'make_glass'].every((id) => gateOf('recipe', id)?.level === 1));
check(`restoration: the ${FIRST_RELIC} restored at 1, every other relic and bauble past it`,
  gateOf('relic', FIRST_RELIC)?.level === 1 && SKILL_GATES.filter((g) => g.skill === 'restoration' && g.id !== FIRST_RELIC).every((g) => g.level > 1));
check('enchanting: Lantern\'s Grace written at 1, the only Formula there',
  gateOf('recipe', `make_${FIRST_FORMULA}_scroll`)?.level === 1
  && RECIPES.filter((r) => r.skill === 'enchanting' && gateOf('recipe', r.id)?.level === 1).map((r) => r.id).join() === `make_${FIRST_FORMULA}_scroll`);
finish('A skill has something open at its start');
