/**
 * A settlement's places count its own workers, not a neighbour's.
 *
 * Reported: "I have 2 wildermon working the deed, confirmed on wildermon UI, and getting an error when try to add the
 * 3rd saying already have 5". On an island the browser holds every worker within sight, a neighbour's as well, and
 * counted them all against your settlement's places: two of yours and a neighbour's four made six of five. Asked of
 * the browser, as an island leaves it: two of yours at work, four of a neighbour's beside them (`mine` false), a
 * settlement at level 5, and a third of yours to set to work.
 */
import { Game } from '../../src/game/game';
import { CREATURE_ACTION_BY_ID } from '../../src/game/creatureActions';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const g = Game.create(4251);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
const [tx, ty] = [64, 64];
g.deed = { name: 'Solara', x: tx, y: ty, radius: 10, level: 5 };
g.player.x = tx + 2.5;
g.player.y = ty + 2.5;
const mine = (species: string, dx: number): void => {
  const c = g.creatures.spawn(species, tx + dx + 0.5, ty + 0.5, 'deed');
  c.mine = true;
};
const theirs = (dx: number): void => {
  const c = g.creatures.spawn('rabba', tx + 12 + dx + 0.5, ty + 0.5, 'deed');
  c.mine = false;
};
mine('cobbe', 1);
mine('cobbe', 2);
for (let i = 0; i < 4; i++) theirs(i);
const third = g.creatures.spawn('tinka', g.player.x + 0.5, g.player.y, 'active');
third.mine = true;

check('two of yours are counted, and none of the neighbour\'s four', g.creatures.workers().length === 2, String(g.creatures.workers().length));
check('nor are theirs among yours at work', g.creatures.working().length === 2, String(g.creatures.working().length));
const why = CREATURE_ACTION_BY_ID.get('assign_deed')!.check?.({ kind: 'creature', id: third.id }, g) ?? null;
check(`a third of yours is taken on at level ${g.deed.level}`, why === null, why ?? 'allowed');

// And in a game of your own, where nothing says whose it is, everything at work is yours.
for (const c of g.creatures.list.values()) delete c.mine;
check('in a game of your own every worker on the list is yours', g.creatures.workers().length === 6, String(g.creatures.workers().length));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na settlement's places count its own workers — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
