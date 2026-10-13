/**
 * Mayors invite, and ranks are set.
 *
 * `deed_member.role` held mayor, builder or guest from the day ranks landed
 * and nothing on the island ever wrote it, so nobody could be made a mayor,
 * and `rpc_invite` and sending anybody away were the founder's alone. The
 * rule now, held to on both sides in the same words:
 *
 *   * the founder sets anybody else on the roll to mayor, builder or guest;
 *   * a mayor sets a builder or a guest to builder or guest, and cannot make
 *     or unmake a mayor;
 *   * nobody changes the founder's rank or their own;
 *   * the founder and a mayor invite, a builder does not, and the two-argument
 *     `rpc_invite` an old browser sends still asks onto the caller's own;
 *   * the founder sends away anybody, a mayor builders and guests only.
 *
 * Every refusal the island gives is compared with the browser's rule
 * (`inviteRefusal`, `rankRefusal`, `sendAwayRefusal`) reading the island's
 * own `rpc_social` answer, word for word. Runs against the database the suite
 * leaves behind.
 */
import { execFileSync } from 'node:child_process';
import type { Social } from '../../src/net/island';
// The game first: `deed.ts` and `actions.ts` import each other through it, and the game is what loads them in order.
import '../../src/game/game';
import { DEFAULT_RANKS, permsOf, rankMay } from '../../src/game/ranks';
import { standingWord } from '../../src/game/deed';
import { defsOf, inviteDeeds, inviteRefusal, myRank, rankedLine, rankOf, rankRefusal, sendAwayRefusal } from '../../src/ui/panels/social';

/*
 * Since ranks became the founder's own (145, `customranks.ts`), Mayor,
 * Builder and Guest are the ranks every settlement starts with, and this
 * holds them to doing exactly what they did. What changed here is the
 * wording -- a refusal names the rank and what it lacks, and somebody ranked
 * is "given the rank of" it -- and the browser's list of ranks, which is now
 * the settlement's own.
 */
const SETTABLE = DEFAULT_RANKS.map((r) => r.name.toLowerCase());
const permsNamed = (name: string): number => permsOf(DEFAULT_RANKS.find((r) => r.name.toLowerCase() === name)!.powers);

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

/* ---- the rule, in the browser alone --------------------------------------- */

console.log('--- the browser');
check('a settlement starts with three ranks besides its founder, highest first',
  SETTABLE.join(',') === 'mayor,builder,guest', SETTABLE.join(','));
check('a mayor is told what a mayor may do', standingWord({ role: 'mayor' }) === `You are a Mayor here: you may ${rankMay(permsNamed('mayor'))}.`,
  standingWord({ role: 'mayor' }));

/* ---- the island, and the browser over its answers -------------------------- */

const out = psql(`
begin;
create temp table said (k text);
do $$
declare w uuid; boss uuid; f uuid[]; may uuid; may2 uuid; bld uuid; gst uuid; nu uuid;
        dname text;
begin
  select id into w from world where name = 'Hoarding';
  select founded_by, name into boss, dname from deed where world_id = w order by founded_at limit 1;
  -- Five people with no settlement of their own: a mayor-to-be, a second
  -- mayor, a builder, a guest-to-be, and somebody new to be asked.
  select array_agg(q.uid order by q.uid) into f from (
    select p.uid from player p where p.world_id = w and p.uid <> boss
       and not exists (select 1 from deed d where d.world_id = w and d.founded_by = p.uid)
     order by p.uid limit 5) q;
  may := f[1]; may2 := f[2]; bld := f[3]; gst := f[4]; nu := f[5];
  delete from deed_member where world_id = w and uid = any(f);
  delete from deed_invite where world_id = w and uid = any(f);
  delete from deed_member where world_id = w and founder = boss;
  delete from deed_invite where world_id = w and founder = boss;
  delete from caller;
  insert into deed_member (world_id, founder, uid, role)
  select w, boss, u, 'builder' from unnest(array[may, may2, bld, gst]) u;
  insert into said values ('DEED|' || dname), ('BOSS|' || boss), ('MAY|' || may), ('MAY2|' || may2),
    ('BLD|' || bld), ('GST|' || gst), ('NU|' || nu),
    ('N_BOSS|' || folk_name(w, boss)), ('N_MAY|' || folk_name(w, may)), ('N_MAY2|' || folk_name(w, may2)),
    ('N_BLD|' || folk_name(w, bld)), ('N_GST|' || folk_name(w, gst)), ('N_NU|' || folk_name(w, nu));

  -- A builder: may not invite, rank or send away.
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('S_BLD|' || rpc_social(w)::text);
  insert into said values ('BLD_INVITE|' || coalesce(rpc_invite(w, nu, boss)->>'why', 'ALLOWED'));
  insert into said values ('BLD_RANK|' || coalesce(rpc_rank(w, boss, gst, 'guest')->>'why', 'ALLOWED'));
  insert into said values ('BLD_SEND|' || coalesce(rpc_leave_deed(w, boss, gst)->>'why', 'ALLOWED'));

  -- The founder makes two mayors and a guest, and is refused what nobody may do.
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  insert into said values ('MADE|' || coalesce(rpc_rank(w, boss, may, 'mayor')->>'role', 'REFUSED'));
  insert into said values ('MADE_TOLD|' || (select text from event where world_id = w and uid = may order by n desc limit 1));
  insert into said values ('MADE2|' || coalesce(rpc_rank(w, boss, may2, 'mayor')->>'role', 'REFUSED'));
  insert into said values ('GUEST|' || coalesce(rpc_rank(w, boss, gst, 'guest')->>'role', 'REFUSED'));
  insert into said values ('ROLE_NOW|' || (select string_agg(m.role, ',' order by array_position(array[may, may2, bld, gst], m.uid))
    from deed_member m where m.world_id = w and m.founder = boss));
  insert into said values ('S_BOSS|' || rpc_social(w)::text);
  insert into said values ('BOSS_SELF|' || coalesce(rpc_rank(w, boss, boss, 'builder')->>'why', 'ALLOWED'));
  insert into said values ('BOSS_BADROLE|' || coalesce(rpc_rank(w, boss, bld, 'founder')->>'why', 'ALLOWED'));
  insert into said values ('BOSS_SAME|' || coalesce(rpc_rank(w, boss, may, 'mayor')->>'why', 'ALLOWED'));
  insert into said values ('BOSS_NOTCIT|' || coalesce(rpc_rank(w, boss, nu, 'builder')->>'why', 'ALLOWED'));

  -- A mayor: ranks builders and guests, invites, sends builders and guests away.
  perform set_config('request.jwt.claims', json_build_object('sub', may)::text, true);
  insert into said values ('S_MAY|' || rpc_social(w)::text);
  insert into said values ('MAY_MAKE|' || coalesce(rpc_rank(w, boss, bld, 'mayor')->>'why', 'ALLOWED'));
  insert into said values ('MAY_UNMAKE|' || coalesce(rpc_rank(w, boss, may2, 'builder')->>'why', 'ALLOWED'));
  insert into said values ('MAY_FOUNDER|' || coalesce(rpc_rank(w, boss, boss, 'guest')->>'why', 'ALLOWED'));
  insert into said values ('MAY_SELF|' || coalesce(rpc_rank(w, boss, may, 'builder')->>'why', 'ALLOWED'));
  insert into said values ('MAY_SETS|' || coalesce(rpc_rank(w, boss, bld, 'guest')->>'role', 'REFUSED'));
  insert into said values ('MAY_SETS_BACK|' || coalesce(rpc_rank(w, boss, bld, 'builder')->>'role', 'REFUSED'));
  insert into said values ('MAY_SETS_TOLD|' || (select text from event where world_id = w and uid = boss order by n desc limit 1));
  insert into said values ('MAY_INVITES|' || coalesce(rpc_invite(w, nu, boss)->>'asked', 'REFUSED'));
  insert into said values ('MAY_INVITE_ROW|' || (select coalesce(asked_by::text, 'none') from deed_invite
    where world_id = w and founder = boss and uid = nu));
  insert into said values ('S_MAY_AGAIN|' || rpc_social(w)::text);
  insert into said values ('MAY_TWICE|' || coalesce(rpc_invite(w, nu, boss)->>'why', 'ALLOWED'));
  insert into said values ('MAY_INV_BOSS|' || coalesce(rpc_invite(w, boss, boss)->>'why', 'ALLOWED'));
  insert into said values ('MAY_OLD|' || coalesce(rpc_invite(w, nu)->>'why', 'ALLOWED'));
  insert into said values ('MAY_SEND_MAYOR|' || coalesce(rpc_leave_deed(w, boss, may2)->>'why', 'ALLOWED'));
  insert into said values ('MAY_SEND_BOSS|' || coalesce(rpc_leave_deed(w, boss, boss)->>'why', 'ALLOWED'));
  insert into said values ('MAY_SEND_GUEST|' || coalesce(rpc_leave_deed(w, boss, gst)->>'left', 'REFUSED'));
  insert into said values ('MAY_SEND_TOLD|' || (select text from event where world_id = w and uid = boss order by n desc limit 1));

  -- The one asked sees who asked, says yes, and both of them hear it.
  perform set_config('request.jwt.claims', json_build_object('sub', nu)::text, true);
  insert into said values ('S_NU|' || rpc_social(w)::text);
  insert into said values ('NU_YES|' || coalesce((rpc_invite_answer(w, boss, true))->>'joined', 'REFUSED'));
  insert into said values ('NU_TOLD_MAY|' || (select text from event where world_id = w and uid = may order by n desc limit 1));
  insert into said values ('NU_TOLD_BOSS|' || (select text from event where world_id = w and uid = boss order by n desc limit 1));
  insert into said values ('NU_ROLE|' || coalesce(deed_role(w, boss, nu), 'none'));

  -- The founder sends a mayor away, and still asks with the two-argument door.
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  insert into said values ('BOSS_SEND_MAYOR|' || coalesce(rpc_leave_deed(w, boss, may2)->>'left', 'REFUSED'));
  insert into said values ('BOSS_OLD|' || coalesce(rpc_invite(w, gst)->>'asked', 'REFUSED'));
  insert into said values ('BOSS_OLD_ROW|' || (select count(*) from deed_invite where world_id = w and founder = boss and uid = gst));
end $$;
select string_agg(k, E'\\n') from said;
rollback;
`);
const got = (key: string): string => out.split('\n').find((l) => l.startsWith(`${key}|`))?.slice(key.length + 1) ?? '(nothing)';
const answer = (key: string): Social => JSON.parse(got(key)) as Social;
const [deed, boss, may, may2, bld, gst, nu] = ['DEED', 'BOSS', 'MAY', 'MAY2', 'BLD', 'GST', 'NU'].map(got);
const [nBoss, nMay, nMay2, nBld, nGst, nNu] = ['N_BOSS', 'N_MAY', 'N_MAY2', 'N_BLD', 'N_GST', 'N_NU'].map(got);
const on = (s: Social) => s.deeds.find((d) => d.founder === boss)!;
const same = (what: string, browser: string | null, island: string): void =>
  check(`${what}, in the same words on both sides`, browser === island && !['ALLOWED', 'REFUSED', '(nothing)'].includes(island),
    `${browser} / ${island}`);

console.log('--- a builder');
const sBld = answer('S_BLD');
check('the island tells a builder their rank', myRank(on(sBld)) === 'builder', String(on(sBld).role));
check('and the browser offers a builder nowhere to invite to', inviteDeeds(sBld).length === 0, String(inviteDeeds(sBld).length));
same('a builder cannot invite', inviteRefusal(sBld, nu, nNu, boss), got('BLD_INVITE'));
same('a builder cannot set a rank', rankRefusal(on(sBld), bld, gst, nGst, 'guest'), got('BLD_RANK'));
same('a builder cannot send anybody away', sendAwayRefusal(on(sBld), bld, gst), got('BLD_SEND'));

console.log('--- the founder');
check('the founder makes a mayor', got('MADE') === 'mayor' && got('MADE2') === 'mayor' && got('GUEST') === 'guest',
  `${got('MADE')}, ${got('MADE2')}, ${got('GUEST')}`);
check('and the roll says so', got('ROLE_NOW') === 'mayor,mayor,builder,guest', got('ROLE_NOW'));
check('the mayor is told what a mayor may do, in the browser\'s words',
  got('MADE_TOLD') === rankedLine(nBoss, 'Mayor', deed, permsNamed('mayor')), `${got('MADE_TOLD')} / ${rankedLine(nBoss, 'Mayor', deed, permsNamed('mayor'))}`);
const sBoss = answer('S_BOSS');
check('the island hands the founder everybody\'s rank',
  rankOf(on(sBoss), may) === 'mayor' && rankOf(on(sBoss), gst) === 'guest' && rankOf(on(sBoss), bld) === 'builder',
  JSON.stringify(on(sBoss).ranks));
check('the founder may give a builder any of the three ranks it does not hold',
  defsOf(on(sBoss)).filter((r) => !rankRefusal(on(sBoss), boss, bld, nBld, r.name)).map((r) => r.name).join(',') === 'Mayor,Guest',
  defsOf(on(sBoss)).filter((r) => !rankRefusal(on(sBoss), boss, bld, nBld, r.name)).map((r) => r.name).join(','));
same('the founder cannot change their own rank', rankRefusal(on(sBoss), boss, boss, nBoss, 'builder'), got('BOSS_SELF'));
same('nobody is made a founder', rankRefusal(on(sBoss), boss, bld, nBld, 'founder'), got('BOSS_BADROLE'));
same('a mayor already a mayor', rankRefusal(on(sBoss), boss, may, nMay, 'mayor'), got('BOSS_SAME'));
same('somebody not on the roll has no rank to change', rankRefusal(on(sBoss), boss, nu, nNu, 'builder'), got('BOSS_NOTCIT'));

console.log('--- a mayor');
const sMay = answer('S_MAY');
check('the island tells a mayor their rank, and the browser offers them that settlement to invite to',
  myRank(on(sMay)) === 'mayor' && inviteDeeds(sMay).map((d) => d.founder).join() === boss,
  `${on(sMay).role}; ${inviteDeeds(sMay).map((d) => d.name).join()}`);
same('a mayor cannot make a mayor', rankRefusal(on(sMay), may, bld, nBld, 'mayor'), got('MAY_MAKE'));
same('a mayor cannot unmake one', rankRefusal(on(sMay), may, may2, nMay2, 'builder'), got('MAY_UNMAKE'));
same('a mayor cannot rank the founder', rankRefusal(on(sMay), may, boss, nBoss, 'guest'), got('MAY_FOUNDER'));
same('a mayor cannot change their own rank', rankRefusal(on(sMay), may, may, nMay, 'builder'), got('MAY_SELF'));
check('a mayor may move a builder to guest and back, and the browser agrees',
  got('MAY_SETS') === 'guest' && got('MAY_SETS_BACK') === 'builder' && rankRefusal(on(sMay), may, bld, nBld, 'guest') === null,
  `${got('MAY_SETS')}, ${got('MAY_SETS_BACK')}, ${rankRefusal(on(sMay), may, bld, nBld, 'guest')}`);
check('and the founder hears it', got('MAY_SETS_TOLD') === `${nMay} gives ${nBld} the rank of Builder at ${deed}.`, got('MAY_SETS_TOLD'));
check('the browser lets a mayor ask somebody new', inviteRefusal(sMay, nu, nNu, boss) === null, String(inviteRefusal(sMay, nu, nNu, boss)));
check('a mayor invites', got('MAY_INVITES') === nNu, got('MAY_INVITES'));
check('and the invitation is the settlement\'s, sent by the mayor', got('MAY_INVITE_ROW') === may, got('MAY_INVITE_ROW'));
const again = answer('S_MAY_AGAIN');
check('the mayor sees it among the invitations out, with its settlement',
  again.sent.some((w) => w.uid === nu && w.founder === boss && w.deed === deed), JSON.stringify(again.sent));
same('asked twice', inviteRefusal(again, nu, nNu, boss), got('MAY_TWICE'));
same('the founder already lives there', inviteRefusal(sMay, boss, nBoss, boss), got('MAY_INV_BOSS'));
same('the two-argument door asks onto a settlement of the mayor\'s own, which there is none of',
  inviteRefusal(sMay, nu, nNu), got('MAY_OLD'));
same('a mayor cannot send away another mayor', sendAwayRefusal(on(sMay), may, may2), got('MAY_SEND_MAYOR'));
same('nor the founder', sendAwayRefusal(on(sMay), may, boss), got('MAY_SEND_BOSS'));
check('a mayor sends a guest away, and the browser offers it',
  got('MAY_SEND_GUEST') === deed && sendAwayRefusal(on(sMay), may, gst) === null, got('MAY_SEND_GUEST'));
check('and the founder hears it', got('MAY_SEND_TOLD') === `${nMay} has taken ${nGst} off the roll of ${deed}.`, got('MAY_SEND_TOLD'));

console.log('--- the one asked');
const sNu = answer('S_NU');
check('is told the mayor asked', sNu.invites.some((i) => i.founder === boss && i.by === nMay && i.deed === deed), JSON.stringify(sNu.invites));
check('says yes and is a builder of it', got('NU_YES') === 'true' && got('NU_ROLE') === 'builder', `${got('NU_YES')}, ${got('NU_ROLE')}`);
check('and the mayor who asked hears it', got('NU_TOLD_MAY') === `${nNu} has come to live at ${deed}.`, got('NU_TOLD_MAY'));
check('and so does the founder', got('NU_TOLD_BOSS') === `${nNu} has come to live at ${deed}.`, got('NU_TOLD_BOSS'));

console.log('--- the founder again');
check('the founder sends a mayor away, and the browser offers it',
  got('BOSS_SEND_MAYOR') === deed && sendAwayRefusal(on(sBoss), boss, may2) === null, got('BOSS_SEND_MAYOR'));
check('the old two-argument rpc_invite still asks onto the founder\'s own',
  got('BOSS_OLD') === nGst && got('BOSS_OLD_ROW') === '1', `${got('BOSS_OLD')}, ${got('BOSS_OLD_ROW')}`);
check('and the browser, naming none, asks onto the founder\'s own as well', inviteRefusal(sBoss, 'u-nobody', 'Nobody') === null,
  String(inviteRefusal(sBoss, 'u-nobody', 'Nobody')));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`mayors invite, and ranks are set — ${ok.length} of ${ok.length}`);
