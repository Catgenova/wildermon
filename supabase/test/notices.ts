/**
 * A settlement's notices.
 *
 * The founder, and every rank holding Post notices, posts a short notice to
 * the settlement and takes any notice down; it keeps the newest
 * `NOTICE_KEEP`. Whoever of its people is ashore hears a new one in the log;
 * everybody else is handed the ones they have not seen as they come ashore,
 * once. Nobody outside the settlement reads or writes them. This holds:
 *
 *   * the limits and every sentence are the same on the island as in the
 *     browser (`notice_max`, `notice_keep`, `settle_said`), and so are the
 *     words of the new power;
 *   * a Mayor posts out of the box; a Builder is refused in the browser's
 *     words until the founder ticks Post notices for Builder, and refused
 *     again when it is unticked; the founder always may;
 *   * a stranger can neither post, take down nor read, and is not handed
 *     the settlement's notices coming ashore;
 *   * an empty notice and one past `NOTICE_MAX` are refused, one of exactly
 *     `NOTICE_MAX` is not, and runs of spaces become one, as `cleanNotice`
 *     makes them;
 *   * the board keeps the newest `NOTICE_KEEP`, dropping the oldest;
 *   * taking down, by a rank that may, and refused to one that may not;
 *   * a citizen ashore hears a new notice in the log and is not shown it again;
 *     one away is shown every unseen one coming ashore, and only once;
 *   * the board lists author and date, newest first;
 *   * nobody signed in is let in, and no browser can read the tables.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import '../../src/game/game';
import { lacksSaid, POWER } from '../../src/game/ranks';
import { cleanNotice, NOTICE_KEEP, NOTICE_MAX, noticeRefusal, SETTLE_SAID, settleLine, type SettleBoard } from '../../src/game/noticeboard';

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

console.log('--- the limits and the words, on both sides');
check('the longest notice and how many are kept are the same on both sides',
  psql('select notice_max() || \'|\' || notice_keep()') === `${NOTICE_MAX}|${NOTICE_KEEP}`, psql('select notice_max() || \'|\' || notice_keep()'));
const keys = Object.keys(SETTLE_SAID) as Array<keyof typeof SETTLE_SAID>;
const said = psql(`select string_agg(coalesce(settle_said(k), '(none)'), E'\\n' order by n) from unnest(array[${keys.map((k) => `'${k}'`).join(',')}]) with ordinality u(k, n);`);
check('every sentence of the notices and the work is the island\'s word for word', said === keys.map((k) => SETTLE_SAID[k]).join('\n'),
  `${keys.length} sentences`);
check('Post notices is a power on the island, at its bit, in the same words',
  psql(`select bit || '|' || may || '|' || may_not || '|' || power_bit('notices') from rank_power where id = 'notices'`)
    === `${POWER.notices.bit}|${POWER.notices.may}|${POWER.notices.mayNot}|${1 << POWER.notices.bit}`);
check('the browser cleans a notice as the island keeps it', cleanNotice('  two \n\n  words\t ') === 'two words');

const out = psql(`
begin;
create temp table said (k text);
do $$
declare w uuid; boss uuid; f uuid[]; may uuid; bld uuid; far uuid; stranger uuid; dname text;
        r_builder bigint; v_n bigint; i int; v_first bigint;
begin
  select id into w from world where name = 'Hoarding';
  select founded_by, name into boss, dname from deed where world_id = w order by founded_at limit 1;
  select array_agg(q.uid order by q.uid) into f from (
    select p.uid from player p where p.world_id = w and p.uid <> boss
       and not exists (select 1 from deed d where d.world_id = w and d.founded_by = p.uid)
     order by p.uid limit 4) q;
  may := f[1]; bld := f[2]; far := f[3]; stranger := f[4];
  delete from deed_member where world_id = w and uid = any(f);
  delete from deed_member where world_id = w and founder = boss;
  delete from deed_notice where world_id = w;
  delete from deed_notice_seen where world_id = w;
  delete from caller;
  insert into deed_member (world_id, founder, uid, role) values (w, boss, may, 'mayor'), (w, boss, bld, 'builder'), (w, boss, far, 'guest');
  select id into r_builder from deed_rank_def where world_id = w and founder = boss and name = 'Builder';
  -- The mayor and the founder are ashore; the guest is away.
  update player set away = false where world_id = w and uid in (boss, may, bld, stranger);
  update player set away = true where world_id = w and uid = far;
  insert into said values ('DEED|' || dname), ('N_BOSS|' || folk_name(w, boss)), ('N_MAY|' || folk_name(w, may));

  -- Nobody signed in.
  perform set_config('request.jwt.claims', '', true);
  begin
    perform rpc_notice_post(w, boss, 'hello');
    insert into said values ('ANON|let in');
  exception when others then insert into said values ('ANON|' || sqlerrm);
  end;

  -- A builder may not; a stranger may not, and may not read.
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('BLD_POST|' || coalesce(rpc_notice_post(w, boss, 'from a builder')->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', stranger)::text, true);
  insert into said values ('STR_POST|' || coalesce(rpc_notice_post(w, boss, 'from outside')->>'why', 'ALLOWED'));
  insert into said values ('STR_READ|' || coalesce(rpc_settlement(w, boss)->>'why', 'ALLOWED'));

  -- The mayor posts, and is refused an empty one and a long one.
  perform set_config('request.jwt.claims', json_build_object('sub', may)::text, true);
  insert into said values ('EMPTY|' || coalesce(rpc_notice_post(w, boss, E'  \\n ')->>'why', 'ALLOWED'));
  insert into said values ('LONG|' || coalesce(rpc_notice_post(w, boss, repeat('x', notice_max() + 1))->>'why', 'ALLOWED'));
  insert into said values ('EXACT|' || coalesce((rpc_notice_post(w, boss, repeat('y', notice_max()))->>'posted'), 'REFUSED'));
  v_first := (rpc_notice_post(w, boss, E'  Bring   wood\\n\\nto the   token  ')->>'posted')::bigint;
  insert into said values ('KEPT|' || (select body from deed_notice where world_id = w and n = v_first));
  -- Heard by the founder and the builder, who are ashore; not by the guest, who is away.
  insert into said values ('HEARD_BOSS|' || (select text from event where world_id = w and uid = boss order by n desc limit 1));
  insert into said values ('HEARD_FAR|' || (select count(*) from event where world_id = w and uid = far and text like '%Bring wood%'));

  -- The stranger, coming ashore, is handed nothing of it; the stranger still may not take it down.
  perform set_config('request.jwt.claims', json_build_object('sub', stranger)::text, true);
  insert into said values ('STR_ASHORE|' || (select count(*) from jsonb_array_elements(rpc_notices_ashore(w)->'notices') e
    where e->>'founder' = boss::text));
  insert into said values ('STR_DROP|' || coalesce(rpc_notice_drop(w, boss, v_first)->>'why', 'ALLOWED'));

  -- The builder, ashore when it went up, is shown neither again; the guest, away, both -- once.
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('BLD_ASHORE|' || jsonb_array_length(rpc_notices_ashore(w)->'notices'));
  perform set_config('request.jwt.claims', json_build_object('sub', far)::text, true);
  insert into said values ('FAR_ASHORE|' || (rpc_notices_ashore(w))::text);
  insert into said values ('FAR_AGAIN|' || jsonb_array_length(rpc_notices_ashore(w)->'notices'));
  insert into said values ('FAR_BOARD|' || rpc_settlement(w, boss)::text);

  -- The founder ticks Post notices for Builder; the builder posts; unticked, refused again.
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  perform rpc_rank_allow(w, r_builder, 'notices', true);
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('BLD_ALLOWED|' || coalesce(rpc_notice_post(w, boss, 'the builders may')->>'posted', 'REFUSED'));
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  perform rpc_rank_allow(w, r_builder, 'notices', false);
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('BLD_AGAIN|' || coalesce(rpc_notice_post(w, boss, 'and now not')->>'why', 'ALLOWED'));
  insert into said values ('BLD_DROP|' || coalesce(rpc_notice_drop(w, boss, v_first)->>'why', 'ALLOWED'));

  -- The founder fills the board past what it keeps.
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  delete from caller;
  for i in 1 .. notice_keep() + 3 loop
    perform rpc_notice_post(w, boss, 'Notice number ' || i);
  end loop;
  insert into said values ('KEPT_N|' || (select count(*) from deed_notice where world_id = w and founder = boss));
  insert into said values ('OLDEST|' || (select body from deed_notice where world_id = w and founder = boss order by n limit 1));
  insert into said values ('FIRST_GONE|' || (select count(*) from deed_notice where world_id = w and n = v_first));

  -- The mayor takes one down; asked again, it is gone.
  perform set_config('request.jwt.claims', json_build_object('sub', may)::text, true);
  select max(n) into v_n from deed_notice where world_id = w and founder = boss;
  insert into said values ('DROP|' || coalesce(rpc_notice_drop(w, boss, v_n)->>'dropped', 'REFUSED'));
  insert into said values ('DROP_AGAIN|' || coalesce(rpc_notice_drop(w, boss, v_n)->>'why', 'ALLOWED'));
  insert into said values ('MAY_BOARD|' || rpc_settlement(w, boss, true)::text);

  -- And no browser reads the tables.
  insert into said values ('SHUT|' || (has_table_privilege('authenticated', 'deed_notice', 'select')
    or has_table_privilege('anon', 'deed_notice', 'select')
    or has_table_privilege('authenticated', 'deed_notice_seen', 'select'))::text
    || ',' || (select bool_and(relrowsecurity) from pg_class where relname in ('deed_notice', 'deed_notice_seen'))::text);
end $$;
select string_agg(k, E'\\n') from said;
rollback;
`);
const got = (key: string): string => out.split('\n').find((l) => l.startsWith(`${key}|`))?.slice(key.length + 1) ?? '(nothing)';
const deed = got('DEED');
const same = (what: string, browser: string | null, island: string): void =>
  check(`${what}, in the same words on both sides`, browser === island && !['ALLOWED', 'REFUSED', '(nothing)'].includes(island),
    `${browser} / ${island}`);

console.log('--- who may post');
check('nobody signed in is let in', got('ANON').includes('not signed in'), got('ANON'));
same('a Builder may not post', lacksSaid(deed, 'Builder', 'notices'), got('BLD_POST'));
same('a stranger may not post', settleLine('stranger', { deed }), got('STR_POST'));
same('a stranger may not read the board', settleLine('stranger', { deed }), got('STR_READ'));
same('nor take a notice down', settleLine('stranger', { deed }), got('STR_DROP'));
check('the founder ticks Post notices for Builder, and a builder posts', /^\d+$/.test(got('BLD_ALLOWED')), got('BLD_ALLOWED'));
same('unticked, a builder is refused again', lacksSaid(deed, 'Builder', 'notices'), got('BLD_AGAIN'));
same('and may not take one down', lacksSaid(deed, 'Builder', 'notices'), got('BLD_DROP'));

console.log('--- what a notice may be');
same('an empty notice is refused', noticeRefusal(' \n '), got('EMPTY'));
same(`one past ${NOTICE_MAX} characters is refused`, noticeRefusal('x'.repeat(NOTICE_MAX + 1)), got('LONG'));
check(`one of exactly ${NOTICE_MAX} goes up, and the browser agrees`, /^\d+$/.test(got('EXACT')) && noticeRefusal('y'.repeat(NOTICE_MAX)) === null, got('EXACT'));
check('runs of spaces and line breaks are kept as one space, as the browser cleans them',
  got('KEPT') === 'Bring wood to the token' && cleanNotice('  Bring   wood\n\nto the   token  ') === got('KEPT'), got('KEPT'));

console.log('--- who hears it');
check('the founder, ashore, hears it in the log in the browser\'s words',
  got('HEARD_BOSS') === `${settleLine('heard', { deed, who: got('N_MAY') })} Bring wood to the token`, got('HEARD_BOSS'));
check('the guest, away, does not hear it then', got('HEARD_FAR') === '0', got('HEARD_FAR'));
check('the builder, ashore when both went up, is shown neither again coming ashore', got('BLD_ASHORE') === '0', got('BLD_ASHORE'));
const farAshore = JSON.parse(got('FAR_ASHORE')) as { notices: Array<{ deed: string; by: string; text: string; at: number }> };
check('the guest coming ashore is shown both, oldest first, with the settlement and who posted them',
  farAshore.notices.length === 2 && farAshore.notices.every((n) => n.deed === deed && n.by === got('N_MAY') && n.at > 0)
    && farAshore.notices[1].text === 'Bring wood to the token', JSON.stringify(farAshore.notices.map((n) => n.text.slice(0, 20))));
check('and only once', got('FAR_AGAIN') === '0', got('FAR_AGAIN'));
check('a stranger coming ashore is shown nothing of it', got('STR_ASHORE') === '0', got('STR_ASHORE'));
const farBoard = JSON.parse(got('FAR_BOARD')) as SettleBoard;
check('a guest reads the board, and may not post to it', farBoard.notices.length === 2 && farBoard.post === false && farBoard.deed === deed,
  `${farBoard.notices.length}, ${farBoard.post}`);

console.log('--- how many are kept');
check(`the board keeps the newest ${NOTICE_KEEP}`, got('KEPT_N') === String(NOTICE_KEEP), got('KEPT_N'));
check('dropping the oldest', got('OLDEST') === 'Notice number 4' && got('FIRST_GONE') === '0', `${got('OLDEST')}, ${got('FIRST_GONE')}`);

console.log('--- taking down');
check('a Mayor takes a notice down', /^\d+$/.test(got('DROP')), got('DROP'));
same('asked again, it is gone', settleLine('noNotice'), got('DROP_AGAIN'));
const mayBoard = JSON.parse(got('MAY_BOARD')) as SettleBoard;
check('the board lists them newest first, with author and date, and the Mayor may post',
  mayBoard.notices.length === NOTICE_KEEP - 1 && mayBoard.notices[0].text === `Notice number ${NOTICE_KEEP + 2}`
    && mayBoard.notices[0].by === got('N_BOSS') && mayBoard.notices.every((n, i, a) => n.at > 0 && (i === 0 || a[i - 1].n > n.n))
    && mayBoard.post === true,
  `${mayBoard.notices.length}, ${mayBoard.notices[0]?.text}, ${mayBoard.notices[0]?.by}`);
check('no browser reads the tables, and row security is on', got('SHUT') === 'false,true', got('SHUT'));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a settlement's notices — ${ok.length} of ${ok.length}`);
