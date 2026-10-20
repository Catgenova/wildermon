/**
 * Ask to join a settlement at its token.
 *
 * Asked for: "Allow players to request to join a settlement at the totem."
 * A stranger standing on a settlement asks from its token (`rpc_join_ask`);
 * the founder and every rank holding Invite hear it and see it in the Social
 * window (`rpc_social`'s `requests`), where one of them lets them in or turns
 * them down (`rpc_join_answer`); the one who asked sees it too (`requesting`)
 * and may take it back (`rpc_join_withdraw`). This holds the island to that,
 * and the browser's two rules over it -- "Stand on X to ask." (`joinFromAfar`)
 * and a full roll (`letInRefusal`) -- to the island's words. Runs against the
 * database the suite leaves behind, in a transaction it rolls back.
 */
import { execFileSync } from 'node:child_process';
import type { Social } from '../../src/net/island';
// The game first: `deed.ts` and `actions.ts` import each other through it, and the game is what loads them in order.
import { DEEDS_JOINED } from '../../src/game/game';
import { joinFromAfar } from '../../src/game/deed';
import { lacksSaid } from '../../src/game/ranks';
import { letInRefusal } from '../../src/ui/panels/social';

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

const out = psql(`
begin;
create temp table said (k text);
do $$
declare w uuid; boss uuid; f uuid[]; may uuid; bld uuid; nu uuid; far uuid; full_ uuid; d deed; i int;
begin
  select id into w from world where name = 'Hoarding';
  select * into d from deed where world_id = w order by founded_at limit 1;
  boss := d.founded_by;
  -- People with no settlement of their own: a mayor, a builder, somebody to ask, somebody too far off to, and
  -- somebody already a citizen of as many as anybody may be.
  select array_agg(q.uid order by q.uid) into f from (
    select p.uid from player p where p.world_id = w and p.uid <> boss
       and not exists (select 1 from deed x where x.world_id = w and x.founded_by = p.uid)
     order by p.uid limit 5 + deeds_joined()::int) q;
  may := f[1]; bld := f[2]; nu := f[3]; far := f[4]; full_ := f[5];
  delete from deed_member where world_id = w and founder = boss;
  delete from deed_invite where world_id = w and founder = boss;
  delete from deed_request where world_id = w and founder = boss;
  delete from deed_member where world_id = w and uid = any(f);
  delete from deed_request where world_id = w and uid = any(f);
  delete from caller;
  insert into deed_member (world_id, founder, uid, role) values (w, boss, may, 'mayor'), (w, boss, bld, 'builder');
  -- Settlements enough elsewhere on the island for one of them to be a citizen of as many as anybody may be.
  for i in 1 .. deeds_joined()::int loop
    insert into deed (world_id, name, x, y, radius, founded_by)
    values (w, 'Elsewhere ' || i, d.x + 200 + i * 40, d.y, 5, f[5 + i]);
    insert into deed_member (world_id, founder, uid) values (w, f[5 + i], full_);
  end loop;
  -- Where each stands: three on the land, one a tile past its edge.
  update player set x = d.x + 0.5, y = d.y + d.radius + 0.5 where world_id = w and uid in (nu, full_);
  update player set x = d.x + d.radius + 1.5, y = d.y + 0.5 where world_id = w and uid = far;
  insert into said values ('DEED|' || d.name), ('X|' || d.x), ('Y|' || d.y), ('R|' || d.radius),
    ('N_NU|' || folk_name(w, nu)), ('N_FULL|' || folk_name(w, full_)), ('JOINED_FULL|' || deeds_joined_by(w, full_)),
    ('FAR_AT|' || (select floor(x)::int || ',' || floor(y)::int from player where world_id = w and uid = far));

  -- No settlement where it is asked.
  perform set_config('request.jwt.claims', json_build_object('sub', nu)::text, true);
  insert into said values ('NO_TOKEN|' || coalesce(rpc_join_ask(w, d.x + 1, d.y)->>'why', 'ALLOWED'));
  -- Too far off, and asked from its land.
  perform set_config('request.jwt.claims', json_build_object('sub', far)::text, true);
  insert into said values ('FAR|' || coalesce(rpc_join_ask(w, d.x, d.y)->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', full_)::text, true);
  insert into said values ('FULL|' || coalesce(rpc_join_ask(w, d.x, d.y)->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('CITIZEN|' || coalesce(rpc_join_ask(w, d.x, d.y)->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  insert into said values ('OWN|' || coalesce(rpc_join_ask(w, d.x, d.y)->>'why', 'ALLOWED'));

  -- Asked.
  perform set_config('request.jwt.claims', json_build_object('sub', nu)::text, true);
  insert into said values ('ASK|' || coalesce(rpc_join_ask(w, d.x, d.y)->>'asked', 'REFUSED'));
  insert into said values ('ASK_TOLD|' || (select text from event where world_id = w and uid = nu order by n desc limit 1));
  insert into said values ('TWICE|' || coalesce(rpc_join_ask(w, d.x, d.y)->>'why', 'ALLOWED'));
  insert into said values ('S_NU|' || rpc_social(w)::text);
  insert into said values ('BOSS_HEARS|' || (select text from event where world_id = w and uid = boss order by n desc limit 1));
  insert into said values ('MAY_HEARS|' || (select text from event where world_id = w and uid = may order by n desc limit 1));
  insert into said values ('BLD_HEARS|' || coalesce((select text from event where world_id = w and uid = bld
    and text like '%asks to join%' order by n desc limit 1), 'nothing'));

  -- Who sees it: the founder and the mayor, not the builder.
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('S_BLD|' || rpc_social(w)::text);
  insert into said values ('BLD_ANSWER|' || coalesce(rpc_join_answer(w, boss, nu, true)->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  insert into said values ('S_BOSS|' || rpc_social(w)::text);

  -- Withdrawn, asked again, and turned down by the founder.
  perform set_config('request.jwt.claims', json_build_object('sub', nu)::text, true);
  insert into said values ('WITHDRAW|' || coalesce(rpc_join_withdraw(w, boss)->>'withdrawn', 'REFUSED'));
  insert into said values ('WITHDRAW_AGAIN|' || coalesce(rpc_join_withdraw(w, boss)->>'why', 'ALLOWED'));
  perform rpc_join_ask(w, d.x, d.y);
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  insert into said values ('NO|' || coalesce(rpc_join_answer(w, boss, nu, false)->>'joined', 'REFUSED'));
  insert into said values ('NO_TOLD|' || (select text from event where world_id = w and uid = nu order by n desc limit 1));
  insert into said values ('NO_AGAIN|' || coalesce(rpc_join_answer(w, boss, nu, false)->>'why', 'ALLOWED'));

  -- Asked once more, and let in by the mayor: on the roll at the newcomers' rank, and everybody hears.
  perform set_config('request.jwt.claims', json_build_object('sub', nu)::text, true);
  perform rpc_join_ask(w, d.x, d.y);
  perform set_config('request.jwt.claims', json_build_object('sub', may)::text, true);
  insert into said values ('YES|' || coalesce(rpc_join_answer(w, boss, nu, true)->>'joined', 'REFUSED'));
  insert into said values ('YES_ROLE|' || coalesce(deed_role(w, boss, nu), 'none'));
  insert into said values ('YES_LEFT|' || (select count(*) from deed_request where world_id = w and founder = boss and uid = nu));
  insert into said values ('YES_TOLD_NU|' || (select text from event where world_id = w and uid = nu order by n desc limit 1));
  insert into said values ('YES_TOLD_BOSS|' || (select text from event where world_id = w and uid = boss order by n desc limit 1));
  insert into said values ('NEWCOMER|' || (select r.name from deed_rank_def r where r.world_id = w and r.founder = boss and r.newcomer));
  insert into said values ('NEWCOMER_MAY|' || (select rank_may(r.perms) from deed_rank_def r where r.world_id = w and r.founder = boss and r.newcomer));

  -- A full roll, asked of the one letting in: a request left over from before they joined a third.
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  insert into deed_request (world_id, founder, uid) values (w, boss, full_);
  insert into said values ('S_BOSS_FULL|' || rpc_social(w)::text);
  insert into said values ('LET_FULL|' || coalesce(rpc_join_answer(w, boss, full_, true)->>'why', 'ALLOWED'));
  insert into said values ('LET_FULL_LEFT|' || (select count(*) from deed_request where world_id = w and founder = boss and uid = full_));

  -- An invitation taken up clears the ask for the same settlement.
  delete from deed_member where world_id = w and founder = boss and uid = nu;
  perform set_config('request.jwt.claims', json_build_object('sub', nu)::text, true);
  perform rpc_join_ask(w, d.x, d.y);
  insert into deed_invite (world_id, founder, uid, asked_by) values (w, boss, nu, boss);
  insert into said values ('INVITED|' || coalesce(rpc_join_ask(w, d.x, d.y)->>'why', 'ALLOWED'));
  perform rpc_invite_answer(w, boss, true);
  insert into said values ('INVITE_CLEARS|' || (select count(*) from deed_request where world_id = w and founder = boss and uid = nu));
end $$;
select string_agg(k, E'\\n') from said;
rollback;
`);
const got = (key: string): string => out.split('\n').find((l) => l.startsWith(`${key}|`))?.slice(key.length + 1) ?? '(nothing)';
const social = (key: string): Social => JSON.parse(got(key)) as Social;
const deed = got('DEED');
const [x, y, radius] = ['X', 'Y', 'R'].map((k) => Number(got(k)));
const nNu = got('N_NU');
const nFull = got('N_FULL');
const same = (what: string, browser: string | null, island: string): void =>
  check(`${what}, in the same words on both sides`, browser === island && !['ALLOWED', 'REFUSED', '(nothing)'].includes(island),
    `${browser} / ${island}`);
const standingAt = (at: string) => {
  const [px, py] = at.split(',').map(Number);
  return { player: { tileX: px, tileY: py } } as Parameters<typeof joinFromAfar>[0];
};

console.log('--- asking');
check('no settlement where nothing stands', got('NO_TOKEN') === 'No settlement token here.', got('NO_TOKEN'));
same('a tile past its edge is too far to ask from', joinFromAfar(standingAt(got('FAR_AT')), { name: deed, x, y, radius }), got('FAR'));
check('and the browser lets you ask from its last tile',
  joinFromAfar(standingAt(`${x},${y + radius}`), { name: deed, x, y, radius }) === null);
check(`a citizen of ${DEEDS_JOINED} may not ask`, got('JOINED_FULL') === String(DEEDS_JOINED)
  && got('FULL') === `Citizen of ${DEEDS_JOINED} settlements: the most allowed. Leave one first.`, got('FULL'));
check('a citizen is one already', got('CITIZEN') === `Already a citizen of ${deed}.`, got('CITIZEN'));
check('nor its founder', got('OWN') === 'Your own settlement.', got('OWN'));
check('a stranger on its land asks', got('ASK') === deed, got('ASK'));
check('and is told so', got('ASK_TOLD') === `Asked to join ${deed}.`, got('ASK_TOLD'));
check('but not twice', got('TWICE') === `Already asked: ${deed}.`, got('TWICE'));
const sNu = social('S_NU');
check('and sees it waiting', (sNu.requesting ?? []).some((q) => q.deed === deed), JSON.stringify(sNu.requesting));

console.log('--- who hears it');
const heard = `${nNu} asks to join ${deed}. (Social, to answer)`;
check('the founder hears it', got('BOSS_HEARS') === heard, got('BOSS_HEARS'));
check('and the mayor, whose rank holds Invite', got('MAY_HEARS') === heard, got('MAY_HEARS'));
check('the builder does not', got('BLD_HEARS') === 'nothing', got('BLD_HEARS'));
check('nor sees it in the window', (social('S_BLD').requests ?? []).length === 0, JSON.stringify(social('S_BLD').requests));
same('nor may answer it', lacksSaid(deed, 'Builder', 'invite'), got('BLD_ANSWER'));
const sBoss = social('S_BOSS');
const q = (sBoss.requests ?? []).find((r) => r.name === nNu);
check('the founder sees who, for where, and how many they live on', !!q && q.deed === deed && q.joined === 0,
  JSON.stringify(sBoss.requests));
check('and the browser lets them in', !!q && letInRefusal(q) === null);

console.log('--- answers');
check('taken back', got('WITHDRAW') === deed && got('WITHDRAW_AGAIN') === 'No request waiting.', `${got('WITHDRAW')}, ${got('WITHDRAW_AGAIN')}`);
check('turned down', got('NO') === 'false', got('NO'));
check('and told so', got('NO_TOLD') === `Request to join ${deed}: turned down.`, got('NO_TOLD'));
check('nothing left to answer', got('NO_AGAIN') === `No request from ${nNu} waiting.`, got('NO_AGAIN'));
check('let in by a mayor', got('YES') === 'true', got('YES'));
check('at the rank for newcomers', got('YES_ROLE') === got('NEWCOMER').toLowerCase(), `${got('YES_ROLE')} / ${got('NEWCOMER')}`);
check('and the ask goes with it', got('YES_LEFT') === '0', got('YES_LEFT'));
check('told in the words an invitation says', got('YES_TOLD_NU')
  === `You are a citizen of ${deed}, at the rank of ${got('NEWCOMER')}: you may ${got('NEWCOMER_MAY')}.`, got('YES_TOLD_NU'));
check('and the founder hears it', got('YES_TOLD_BOSS') === `${nNu} has come to live at ${deed}.`, got('YES_TOLD_BOSS'));
const full = (social('S_BOSS_FULL').requests ?? []).find((r) => r.name === nFull);
same('somebody on a full roll is not let in', full ? letInRefusal(full) : null, got('LET_FULL'));
check('and their ask is left standing', got('LET_FULL_LEFT') === '1', got('LET_FULL_LEFT'));
check('an invitation waiting is answered in Social instead', got('INVITED') === `Invitation from ${deed} waiting. (Social, to answer)`, got('INVITED'));
check('and taking it up clears the ask', got('INVITE_CLEARS') === '0', got('INVITE_CLEARS'));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`ask to join at the token — ${ok.length} of ${ok.length}`);
