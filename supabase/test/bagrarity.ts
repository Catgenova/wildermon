/**
 * A bag's rarity: more room, and a worn bag's carry limit bonus more by the same step.
 *
 * Asked for: "backpack rarity should increase storage capacity like with containers", and of the carry limit bonus a
 * worn bag gives: "Yes it should raise carry capacity". A bag's room takes `RARITY_ROOM` more a rarity step
 * (`roomFor`, the island's `room_for`); its carry limit bonus takes `RARITY_ROOM` more of the bonus a step, unrounded
 * (`rarityShare`, `bagCarry`; the island's `rarity_share`, `bag_carry`). Examine says this bag's room and bonus in the
 * kind's text (`bagText`, the island's `bag_text`).
 *
 * Asks that a backpack's and a sack's room and carry limit bonus at each rarity are the same number on both sides;
 * that a rare backpack's text says its own room and bonus, the same on both sides, and Examine on the island says it;
 * and that a supreme backpack worn lifts the carry limit by its bonus × (1 + 2 × `RARITY_ROOM`) on both sides.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on it. Rolled back.
 */
import { Game } from '../../src/game/game';
import { BAG_CARRY, bagCarry, bagCarryPct, bagText } from '../../src/game/gear';
import { bagRoom, itemDef, RARITIES, RARITY_ROOM, roomFor, type Item } from '../../src/game/items';
import { psql, ok, bad, check } from './harness';

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
const STEPS = RARITIES.map((_, i) => i);
const KINDS = ['backpack', 'sack'];
const QL = 83.5;
const bag = (id: string, ql: number, rare: number): Item => ({ uid: 0, id, ql, dmg: 0, count: 1, ...(rare ? { rare } : {}) }) as Item;

/* ---- the browser ----------------------------------------------------------- */

for (const id of KINDS) {
  const base = itemDef(id).holds ?? 0;
  check(`${id}: room ${STEPS.map((n) => bagRoom(bag(id, QL, n))).join(', ')}, ${RARITY_ROOM * 100}% more of it a step`,
    STEPS.every((n) => bagRoom(bag(id, QL, n)) === roomFor(base, { rare: n }) && bagRoom(bag(id, QL, n)) === base + Math.round(base * RARITY_ROOM * n)));
  check(`${id}: carry limit bonus ${STEPS.map((n) => bagCarry(bag(id, 100, n))).join(', ')} at QL 100, ${RARITY_ROOM * 100}% more of it a step`,
    STEPS.every((n) => near(bagCarry(bag(id, QL, n)), BAG_CARRY[id] * QL / 100 * (1 + RARITY_ROOM * n))));
}
check('a backpack: 60, 63, 66, 69 things', STEPS.map((n) => bagRoom(bag('backpack', 50, n))).join(',') === '60,63,66,69');

const RARE = bag('backpack', 80, 1);
const TEXT = bagText(RARE, itemDef('backpack').description ?? '');
const WANT_ROOM = `Holds ${roomFor(60, { rare: 1 })} things.`;
const WANT_CARRY = `carry limit +${bagCarryPct(BAG_CARRY.backpack * 0.8 * (1 + RARITY_ROOM))}.`;
check(`a rare backpack at QL 80 says ${WANT_ROOM}`, TEXT.includes(WANT_ROOM), TEXT);
check(`and ${WANT_CARRY}`, TEXT.includes(WANT_CARRY) && WANT_CARRY === 'carry limit +42%.', TEXT);
check('and no kind\'s numbers left', !TEXT.includes('Holds 60') && !TEXT.includes('× QL%'), TEXT);
check('an ordinary satchel says the kind\'s room', bagText(bag('satchel', 50, 0), itemDef('satchel').description ?? '') === itemDef('satchel').description);

const SUPREME = 1 + BAG_CARRY.backpack * (1 + 2 * RARITY_ROOM);
{
  const g = Game.create(6262);
  const bare = g.carryLimit();
  const pack = g.inventory.add('backpack', { ql: 100, rare: 2 });
  g.equip('back', pack.uid);
  check(`a supreme backpack at QL 100 worn: ×${SUPREME}`, near(g.carryLimit(), bare * SUPREME), `${bare} → ${g.carryLimit()}`);
}

/* ---- the island ------------------------------------------------------------ */

const rare = (n: number): string => (n ? `'${RARITIES[n].name}'` : 'null');
const out = psql(`
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid; v_pack bigint; v_bare double precision; it item;
begin
  select id into w from world where name = 'Hoarding';
  select uid into u from player where world_id = w and name = 'Dane';
  update player set equipped = equipped - 'back' - 'side' where world_id = w and uid = u;
${KINDS.flatMap((id) => STEPS.map((n) => `
  v_pack := give(w, u, '${id}', 1, ${QL}, null, ${rare(n)}); select * into it from item where id = v_pack;
  insert into said values ('${id}${n}', bag_room(it)::text || '|' || bag_carry(it)::text);
  v_pack := give(w, u, '${id}', 1, 100, null, ${rare(n)}); select * into it from item where id = v_pack;
  insert into said values ('${id}${n}full', bag_carry(it)::text);`)).join('')}
  v_pack := give(w, u, 'backpack', 1, 80, null, 'rare'); select * into it from item where id = v_pack;
  insert into said values ('TEXT', bag_text(it, (select description from item_def where id = 'backpack')));
  insert into said values ('EXAMINE', examine_item_text(w, u, it));
  v_bare := carry_limit(w, u);
  v_pack := give(w, u, 'backpack', 1, 100, null, 'supreme');
  perform perform_fight(w, u, 'equip', jsonb_build_object('kind', 'item', 'uid', v_pack));
  insert into said select 'WORN', coalesce(equipped->>'back', '-') || '|' || v_pack from player where world_id = w and uid = u;
  insert into said values ('WORE', (carry_limit(w, u) / v_bare)::text);
end $t$;
select k || '=' || replace(v, E'\\n', ' ') from said;
rollback;`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const say = (k: string): string => said.get(k) ?? 'unsaid';

for (const id of KINDS) {
  for (const n of STEPS) {
    const want = `${bagRoom(bag(id, QL, n))}|${bagCarry(bag(id, QL, n))}`;
    check(`on the island, ${RARITIES[n].name || 'ordinary'} ${id} at QL ${QL}: room and carry limit bonus the browser's, ${want}`, say(`${id}${n}`) === want, say(`${id}${n}`));
    check(`and at QL 100: ${bagCarry(bag(id, 100, n))}`, say(`${id}${n}full`) === String(bagCarry(bag(id, 100, n))), say(`${id}${n}full`));
  }
}
check('on the island, a rare backpack at QL 80 says the browser\'s text', say('TEXT') === TEXT, `${say('TEXT')} | ${TEXT}`);
check(`and Examine says ${WANT_ROOM} … ${WANT_CARRY}`, say('EXAMINE').includes(` ${TEXT}`), say('EXAMINE'));
const [back, pack] = say('WORN').split('|');
check('on the island the supreme backpack is worn', back === pack, say('WORN'));
check(`on the island, a supreme backpack at QL 100 worn: ×${SUPREME}`, Math.abs(Number(say('WORE')) - SUPREME) < 1e-9, say('WORE'));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`a bag's rarity — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
