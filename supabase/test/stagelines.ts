/**
 * Lines that name a wildermon at its stage, the lamp's preview, and a worker's idle tag.
 *
 * Asked for: every creature line names it at its stage (an evolved one was named as its first stage); the trait lamp
 * says what it would reroll before it is used; an idle worker is marked over its head.
 *
 *   npx esbuild supabase/test/stagelines.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/stagelines.mjs && node node_modules/.cache/stagelines.mjs
 */
import { Game } from '../../src/game/game';
import { EVOLVE_AT, kindName, levelSkill, SPECIES, stageOf } from '../../src/game/creatures';
import { crateLine } from '../../src/game/creaturecrate';
import { creatureSkills } from '../../src/ui/creatureinfo';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { lampPreview, TIERS, TRAITS, traitName, traitTier, TRAIT_SLOTS, LAMP_TIER_ODDS } from '../../src/game/traits';
import { creatureLabel, IDLE_TAG } from '../../src/game/owner';
import { check, finish } from './harness';

const g = Game.create(4321, 64);
// A kind that evolves, at its last stage.
const kindId = Object.keys(SPECIES).find((k) => SPECIES[k].stages && !SPECIES[k].monster && !SPECIES[k].hybrid && levelSkill(SPECIES[k]))!;
const def = SPECIES[kindId];
const c = g.creatures.spawn(kindId, g.spawn.x + 1.5, g.spawn.y + 1.5, 'wild', g.rand, g.time - 3600 * 24 * 30);
// (a stage is read off its level in its kind's skill: the third stage's least)
const skill = levelSkill(def);
c.skills = { ...c.skills, ...(skill ? { [skill]: EVOLVE_AT[1] } : {}) };
const name = kindName(c);
check(`an evolved ${def.name} is named at its stage: ${def.stages![1].name}`, stageOf(c) === 2 && name === def.stages![1].name, `${name} / ${def.name}`);
check('its skills card names it so', creatureSkills(g, c)[0] === `Wild ${name}: skills`, creatureSkills(g, c)[0]);
c.mode = 'stored';
check('a wildermon crate names it so', crateLine(g, { creature: c.id }).includes(name.toLowerCase()), crateLine(g, { creature: c.id }));
c.mode = 'wild';

// The lamp: what it would reroll.
const common = TRAITS.filter((t) => traitTier(t.id) === TIERS[0]).slice(0, 2).map((t) => t.id);
const rare = TRAITS.filter((t) => traitTier(t.id) === TIERS[1]).slice(0, TRAIT_SLOTS - 2).map((t) => t.id);
const full = [...rare, ...common];
check('the lamp says the lowest-rarity traits it would reroll, and the chance up',
  lampPreview(full) === `rerolls ${common.map(traitName).join(' or ')} (${TIERS[0]}), 1 in ${LAMP_TIER_ODDS} ${TIERS[1]}`, lampPreview(full));
check('and an empty slot it would fill', lampPreview(full.slice(0, TRAIT_SLOTS - 1)).startsWith(`fills an empty slot: ${TIERS[0]}`), lampPreview(full.slice(0, TRAIT_SLOTS - 1)));
const lamp = ACTION_BY_ID.get('use_ancient_lamp')!;
c.mode = 'active';
c.traits = full;
const label = lamp.labelFor?.({ kind: 'creature', id: c.id } as Target, g) ?? '';
check('its menu label says it', label.endsWith(`: ${lampPreview(full)}`), label);

// An idle worker's tag.
{
  const said = creatureLabel({ name: 'Moss', mode: 'deed', mine: true }, 'me') + IDLE_TAG;
  check(`an idle worker of yours: "${IDLE_TAG.trim()}" after its name over its head`, said.startsWith('Moss') && said.endsWith(' · idle'), said);
}

finish('Lines at its stage, the lamp\'s preview, idle');
