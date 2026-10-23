/**
 * A bag worn carries more.
 *
 * Asked for: "Equipping a backpack increases weight held by up to 50%, a sack 25%. Both can be equipped and QL
 * determines what % bonus they apply." A backpack goes on the back and a sack at the side (`slotOf`, the island's
 * `slot_of`); the carry limit is the rest of it times one and each worn bag's share at QL 100 times its QL / 100
 * (`bagCarry`, the island's `bags_carry`).
 *
 * Asks that the shares and the slots are the browser's on the island; that in the browser and on the island a
 * backpack at QL 60 and a sack at QL 100 worn lift the limit by 0.5 × 0.6 + 0.25 × 1; that one in the pack and not
 * worn lifts nothing; and that the island lets a backpack be put on (`act_refusal` 'equip').
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on it. Rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { BAG_CARRY, bagCarry, slotOf } from '../../src/game/gear';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
const WANT = 1 + BAG_CARRY.backpack * 0.6 + BAG_CARRY.sack * 1;

/* ---- the browser ----------------------------------------------------------- */

check('a backpack is worn on the back, a sack at the side', slotOf('backpack') === 'back' && slotOf('sack') === 'side');
{
  const g = Game.create(6161);
  const bare = g.carryLimit();
  const pack = g.inventory.add('backpack', { ql: 60 });
  const sack = g.inventory.add('sack', { ql: 100 });
  check('carried and not worn, no more', near(g.carryLimit(), bare), `${bare} → ${g.carryLimit()}`);
  g.equip('back', pack.uid);
  g.equip('side', sack.uid);
  check(`worn, a backpack at QL 60 and a sack at QL 100: ×${WANT}`, near(g.carryLimit(), bare * WANT), `${bare} → ${g.carryLimit()}`);
  check('the share is the QL\'s: QL 30 a backpack ×1.15', near(bagCarry({ id: 'backpack', ql: 30 }), 0.15));
}

/* ---- the island ------------------------------------------------------------ */

const out = psql(`
begin;
create temp table said (k text, v text);
insert into said values ('DEFS', bag_carry_backpack()::text || '|' || bag_carry_sack()::text);
insert into said values ('SLOTS', slot_of('backpack') || '|' || slot_of('sack'));
do $t$
declare w uuid; u uuid; v_pack bigint; v_sack bigint; v_bare double precision;
begin
  select id into w from world where name = 'Hoarding';
  select uid into u from player where world_id = w and name = 'Dane';
  update player set equipped = equipped - 'back' - 'side' where world_id = w and uid = u;
  v_bare := carry_limit(w, u);
  v_pack := give(w, u, 'backpack', 1, 60);
  v_sack := give(w, u, 'sack', 1, 100);
  insert into said values ('CARRIED', (carry_limit(w, u) / v_bare)::text);
  insert into said values ('EQUIP', coalesce(act_refusal(w, u, 'equip', jsonb_build_object('kind', 'item', 'uid', v_pack)), 'allowed'));
  perform perform_fight(w, u, 'equip', jsonb_build_object('kind', 'item', 'uid', v_pack));
  perform perform_fight(w, u, 'equip', jsonb_build_object('kind', 'item', 'uid', v_sack));
  insert into said select 'WORN', coalesce(equipped->>'back', '-') || '|' || coalesce(equipped->>'side', '-') || '|' || v_pack || '|' || v_sack
    from player where world_id = w and uid = u;
  insert into said values ('WORE', (carry_limit(w, u) / v_bare)::text);
end $t$;
select k || '=' || v from said;
rollback;`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const say = (k: string): string => said.get(k) ?? 'unsaid';

check('the shares are the browser\'s on the island', say('DEFS') === `${BAG_CARRY.backpack}|${BAG_CARRY.sack}`, say('DEFS'));
check('and the slots', say('SLOTS') === 'back|side', say('SLOTS'));
check('on the island, carried and not worn, no more', near(Number(say('CARRIED')), 1), say('CARRIED'));
check('on the island a backpack may be put on', say('EQUIP') === 'allowed', say('EQUIP'));
const [back, side, pack, sack] = say('WORN').split('|');
check('on the island both are worn, each in its own place', back === pack && side === sack, say('WORN'));
check(`on the island, worn: ×${WANT}`, Math.abs(Number(say('WORE')) - WANT) < 1e-9, say('WORE'));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`a bag worn carries more — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
