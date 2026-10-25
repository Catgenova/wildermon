/**
 * The builds the island takes (20261026130900).
 *
 *   * with no build handed over, any build is taken, and a build with none;
 *   * the deploy's list goes in through supabase/build.sql as the migrate job
 *     runs it, and its builds are taken; one it did not name is refused, with
 *     the words the page shows (`STALE_BUILD`);
 *   * the next deploy retires the last one's builds, which are still taken
 *     for the grace (an hour) and refused after it; one handed over again is
 *     current again;
 *   * a build whose deploy number is past every one handed over is taken
 *     (the site is served before the deploy reaches the island), and one at or
 *     under it with an unknown hash is not;
 *   * a check that fails takes the build;
 *   * a list with nothing in it changes nothing, and nothing but 16 hex
 *     digits is ever kept;
 *   * no browser reads the table or calls the helpers, and nobody signed out
 *     calls the door.
 *
 * Keeps whatever builds the database held before it and puts them back.
 */
import { execFileSync } from 'node:child_process';
import { STALE_BUILD } from '../../src/version';

const ENV = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
  PGPORT: process.env.PGPORT ?? '5433',
  PGUSER: process.env.PGUSER ?? 'wurm',
  PGDATABASE: process.env.PGDATABASE ?? 'postgres',
};

interface Ran { out: string; err: string }
const sql = (text: string, args: string[] = []): Ran => {
  try {
    const out = execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', ...args, '-f', '-'],
      { input: text, encoding: 'utf8', env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
    return { out: out.trim(), err: '' };
  } catch (e) {
    const x = e as { stdout?: string; stderr?: string };
    return { out: (x.stdout ?? '').trim(), err: (x.stderr ?? '').trim() || String(e) };
  }
};
const psql = (text: string): string => {
  const r = sql(text);
  if (r.err) throw new Error(r.err);
  return r.out;
};
const as = (who: string, text: string): Ran => sql(
  `select set_config('request.jwt.claims', '${JSON.stringify({ sub: who })}', false) \\g /dev/null\nset role authenticated;\n${text}\n`);

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const ANNA = 'eb000000-0000-4000-8000-000000000001';
const A = '0123456789abcdef';
const B = 'fedcba9876543210';
const C = 'aaaaaaaaaaaaaaaa';
const UNKNOWN = '1111222233334444';

/** The deploy, as the migrate job runs supabase/build.sql. */
const deploy = (builds: Array<{ build: string; deploy: number | null }>): Ran =>
  sql('', ['-v', `builds=${JSON.stringify(builds)}`, '-f', 'supabase/build.sql']);
/** What the join's check answers this build, as Anna. */
const asked = (build: string | null, dep: number | null = null): { ok?: boolean; why?: string } => {
  // Every door is paced (`private.pace`); this asks far faster than a join does.
  psql(`delete from caller where uid = '${ANNA}';`);
  const r = as(ANNA, `select rpc_build_check(${build === null ? 'null' : `'${build}'`}, ${dep === null ? 'null' : dep});`);
  if (r.err) return { why: r.err };
  return JSON.parse(r.out) as { ok?: boolean; why?: string };
};

const kept = psql(`select coalesce(jsonb_agg(to_jsonb(b)), '[]') from private.build_ok b;`);
psql(`delete from private.build_ok; delete from caller where uid = '${ANNA}';`);

console.log('--- nothing handed over');
check('with no build handed over, a build is taken', asked(A, 10).ok === true);
check('and so is a page that names none', asked(null).ok === true);

console.log('--- the deploy');
const first = deploy([{ build: A, deploy: 10 }, { build: B, deploy: 10 }]);
check('supabase/build.sql hands the deploy\'s builds over and says how many are current', !first.err && first.out === '2', first.err || first.out);
check('the current build is taken', asked(A, 10).ok === true);
check('and the one the job built beside it', asked(B, 10).ok === true);
const unknown = asked(UNKNOWN, 10);
check('a build it did not name is refused', unknown.ok === false, JSON.stringify(unknown));
check('in the words the page shows', unknown.why === STALE_BUILD, String(unknown.why));
check('and so is one with no deploy number', asked(UNKNOWN).ok === false);
check('a hash is read as its first 16 digits, in any case', asked(`${A.toUpperCase()}ffff`, 10).ok === true);

console.log('--- the next deploy');
const second = deploy([{ build: C, deploy: 11 }]);
check('the next deploy leaves one build current', second.out === '1', second.err || second.out);
check('the new build is taken', asked(C, 11).ok === true);
check('the last deploy\'s build is still taken within the grace', asked(A, 10).ok === true);
const retired = psql(`select count(*) from private.build_ok where hash in ('${A}', '${B}') and retired_at is not null;`);
check('because it was retired, not dropped', retired === '2', retired);
const grace = psql(`select extract(epoch from private.build_grace())::int;`);
check('the grace is an hour', grace === '3600', grace);
psql(`update private.build_ok set retired_at = now() - private.build_grace() - interval '1 minute' where hash = '${A}';`);
check('and refused once the grace is past', asked(A, 10).ok === false);
check('while one retired inside it is still taken', asked(B, 10).ok === true);
const again = deploy([{ build: A, deploy: 12 }]);
check('a build handed over again is current again', !again.err && asked(A, 12).ok === true && asked(C, 11).ok === true, again.err);

console.log('--- ahead of the deploy');
check('a build of a later deploy than any handed over is taken', asked(UNKNOWN, 13).ok === true);
check('one of the same deploy with a hash nobody handed over is not', asked(UNKNOWN, 12).ok === false);

console.log('--- odd lists');
const none = deploy([]);
check('a list with nothing in it changes nothing', none.out === '1' && asked(A, 12).ok === true, none.err || none.out);
const junk = deploy([{ build: 'not a hash', deploy: 14 }, { build: "x'); drop table player; --", deploy: 14 }]);
const rows = psql(`select count(*) from private.build_ok where hash !~ '^[0-9a-f]{16}$';`);
check('nothing but 16 hex digits is kept, and a quote in the list stays a string', rows === '0' && junk.out === '1'
  && psql(`select to_regclass('public.player') is not null;`) === 't', `${junk.err || junk.out} ${rows}`);

console.log('--- a check that fails');
const failed = as(ANNA, `reset role;
begin;
alter table private.build_ok rename to build_ok_gone;
select set_config('request.jwt.claims', '${JSON.stringify({ sub: ANNA })}', true) \\g /dev/null
set local role authenticated;
select rpc_build_check('${UNKNOWN}', 1);
rollback;`);
check('takes the build', failed.out.split('\n').some((l) => l.includes('"ok": true')), failed.err || failed.out);
check('and the table is still there', psql(`select to_regclass('private.build_ok') is not null;`) === 't');

console.log('--- shut');
check('no browser reads the builds', as(ANNA, 'select count(*) from private.build_ok;').err.includes('permission denied'));
const helpers = ['builds_deployed(\'[]\')', `build_taken('${A}', 1)`, 'build_grace()']
  .filter((h) => !as(ANNA, `select private.${h};`).err);
check('or calls the helpers', helpers.length === 0, helpers.join(' '));
check('nobody signed out calls the door', sql(`set role anon;\nselect rpc_build_check('${A}', 1);`).err.includes('permission denied'));

psql(`delete from private.build_ok; delete from caller where uid = '${ANNA}';
insert into private.build_ok select * from jsonb_populate_recordset(null::private.build_ok, '${kept}'::jsonb);`);
for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`the builds the island takes — ${ok.length} of ${ok.length}`);
