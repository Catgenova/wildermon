/**
 * Every making skill (one with recipes) has something open at its start (`SkillDef.start`): a gate in it at or under
 * that level (a recipe by `recipeLevel`, a sprout, an ore smelted, a casting worked), or the skill is in
 * `TRAINED_ELSEWHERE`, named with what trains it, which has no gate.
 *
 * Reported: a new body could not chisel stone bricks (Guiding Light, Stone bricks) at stonecutting 1, and nothing
 * else trained stonecutting: its lowest recipe was the whetstone at 5, the kit's whetstone and quern cannot be
 * improved. Milling (flour at 5) and glassblowing (glass at 5) were the same.
 *
 *   npx esbuild supabase/test/firststeps.ts --bundle --platform=node --format=esm --loader:.png=dataurl \
 *     --outfile=node_modules/.cache/firststeps.mjs && node node_modules/.cache/firststeps.mjs
 */
import { RECIPES } from '../../src/game/recipes';
import '../../src/game/craftgates';
import { SKILL_DEFS } from '../../src/game/skills';
import { gateOf, SKILL_GATES } from '../../src/game/skillgates';
import { check, finish } from './harness';

/** Skills whose every gate is past their start, and what trains them before it. */
const TRAINED_ELSEWHERE: Readonly<Record<string, string>> = {
  brewing: 'a brew set going at a barrel (brewing.ts)',
  repair: 'Repair (actions.ts)',
  enchanting: 'enchanting with a scroll (enchanting.ts)',
};

const lowest = (skill: string): number => Math.min(...SKILL_GATES.filter((g) => g.skill === skill).map((g) => g.level));
const shut: string[] = [];
for (const s of SKILL_DEFS) {
  if (!RECIPES.some((r) => r.skill === s.id)) continue;
  if (lowest(s.id) > s.start && !TRAINED_ELSEWHERE[s.id]) shut.push(`${s.id} ${s.start}: lowest gate ${lowest(s.id)}`);
}
check('every making skill has something open at its start, or is trained by something else', shut.length === 0, shut.join('; '));
for (const s of Object.keys(TRAINED_ELSEWHERE)) {
  const start = SKILL_DEFS.find((d) => d.id === s)!.start;
  check(`${s}: still has nothing open at its start (else take it off the list)`, lowest(s) > start, `lowest ${lowest(s)}`);
}
check('stone brick, flour and glass open at 1, the Guiding Light\'s Stone bricks step at a new body\'s stonecutting',
  ['make_stone_brick', 'make_flour', 'make_glass'].every((id) => gateOf('recipe', id)?.level === 1));
finish('A making skill makes something at its start');
