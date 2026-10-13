/**
 * Things of one kind keep one place in a list.
 *
 * Three nail moulds in the pack came out in whatever order the pack was last
 * rearranged in, and every pour rearranged it, so the one you meant moved
 * under the pointer between one menu and the next. `orderBy` breaks every
 * tie down to the thing itself, so the order is the same however the list it
 * is handed was shuffled.
 *
 * Needs no database.
 */
import '../../src/game/actions';
import { SORTS, orderBy } from '../../src/ui/sorting';
import type { Item } from '../../src/game/items';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const mould = (uid: number, ql: number, dmg = 0): Item => ({ uid, id: 'nail_mould', ql, dmg, count: 1 } as Item);
const pack = [mould(7, 30), mould(3, 30), mould(12, 55, 4), mould(5, 30, 2), mould(9, 12)];
const shuffles = [pack, [...pack].reverse(), [pack[2], pack[4], pack[0], pack[3], pack[1]], [pack[1], pack[3], pack[0], pack[4], pack[2]]];

for (const [key, label] of SORTS) {
  const orders = shuffles.map((s) => orderBy(s, key).map((it) => it.uid).join(','));
  check(`five nail moulds by ${label.toLowerCase()} come out in one order however the pack was shuffled`,
    orders.every((o) => o === orders[0]), orders.join(' / '));
}
const byName = orderBy(shuffles[2], 'name').map((it) => it.uid);
check('of one name, the best first and then the oldest', byName.join(',') === '12,3,5,7,9', byName.join(','));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthings of one kind keep their place — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
