/**
 * Hostile creatures are marked over whatever stands in front of them.
 *
 * Asked: "it's tough to see threats, especially in a mess of trees, maybe it'd
 * be good to have a red silhouette or a hovering icon or something on
 * hostiles". This asks what counts as hostile (`threatens`): every wild
 * creature of a kind that hunts on sight, and anything hunting you; never a
 * wild creature that only bolts or fights back, and never one of yours.
 * And that it is on unless turned off. No database.
 */
import { Game } from '../../src/game/game';
import { PLAYER_ATTACKER, SPECIES, threatens } from '../../src/game/creatures';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const g = Game.create(4250);
const old = g.time - 3600 * 24 * 40;
const at = (id: string, mode: 'wild' | 'active') => g.creatures.spawn(id, g.player.x + 2, g.player.y + 2, mode, g.rand, old);

const hunters = Object.values(SPECIES).filter((s) => s.hunter).map((s) => s.id);
const marked = hunters.filter((id) => threatens(at(id, 'wild'), SPECIES[id]));
check(`every wild one of the ${hunters.length} kinds that hunt on sight is marked`, hunters.length > 0 && marked.length === hunters.length,
  hunters.filter((id) => !marked.includes(id)).join(', ') || hunters.join(', '));

const calm = Object.values(SPECIES).filter((s) => !s.hunter).map((s) => s.id);
const quiet = calm.filter((id) => !threatens(at(id, 'wild'), SPECIES[id]));
check('a wild one of any other kind is not, while it leaves you alone', quiet.length === calm.length,
  calm.filter((id) => !quiet.includes(id)).join(', '));

const struck = at(calm[0], 'wild');
struck.enemy = PLAYER_ATTACKER;
check(`but one hunting you is, whatever its kind (${SPECIES[calm[0]].name}, struck)`, threatens(struck, SPECIES[calm[0]]));

const tame = at(hunters[0], 'active');
check(`one of yours never is, even of a kind that hunts (${SPECIES[hunters[0]].name})`, !threatens(tame, SPECIES[hunters[0]]));

const dead = at(hunters[0], 'wild');
dead.health = 0;
check('nor one already dead', !threatens(dead, SPECIES[hunters[0]]));

check('the marking is on unless turned off in Settings', g.settings.markThreats === true);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nhostiles marked — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
