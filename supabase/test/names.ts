/**
 * A name as you write it.
 *
 * Asked: "Players currently can only name themselves in all lowercase for
 * account/player name, please correct to allow some free will there". The
 * name was read back out of the sign-in address, which Auth folds to
 * lowercase. This asks, of both sides:
 *
 *   * the capitals written at sign-up are the name the island hands back, and
 *     the name everybody is shown (`account_name`);
 *   * capitals that do not fold back to the account's own name are not kept,
 *     by the island or by the table itself;
 *   * an account may change its capitals and nothing else, and every island
 *     it is on shows the new ones at once;
 *   * the browser leaves the capitals as typed, signs in with the folded
 *     letters, and refuses the same shapes the island does.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { foldName, nameEmail, nameTrouble, writtenName } from '../../src/net/accounts';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
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

const MIRA = '3a3e0000-0000-4000-8000-0000000000a1';
const BRAN = '3a3e0000-0000-4000-8000-0000000000b2';
const COLL = '3a3e0000-0000-4000-8000-0000000000c3';
const as = (uid: string): string => `perform set_config('request.jwt.claims', json_build_object('sub', '${uid}')::text, true);`;
const tried = (k: string, call: string): string =>
  `begin insert into said values ('${k}', (${call})::text); exception when others then insert into said values ('${k}', 'refused: ' || sqlerrm); end;`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
delete from account where uid in ('${MIRA}', '${BRAN}', '${COLL}');
delete from auth.users where id in ('${MIRA}', '${BRAN}', '${COLL}');
insert into auth.users (id, email, raw_user_meta_data) values
  ('${MIRA}', '${nameEmail('MiRa')}', '{"display": "MiRa"}'),
  ('${BRAN}', '${nameEmail('bran')}', '{"display": "Hild"}'),
  ('${COLL}', '${nameEmail('coll')}', null);
do $t$
declare w uuid;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Names', 167, 32, 10, 10, true) returning id into w;
  perform land_blank(w, 32);
  ${as(MIRA)}
  insert into said values ('MIRA', rpc_my_name());
  insert into said values ('MIRA-SHOWN', account_name('${MIRA}'));
  ${as(BRAN)}
  insert into said values ('BRAN', rpc_my_name());
  ${as(COLL)}
  insert into said values ('COLL', rpc_my_name());
  perform rpc_join(w, rpc_my_name());
  ${tried('COLL-CASED', "rpc_name_case(' Coll ')")}
  insert into said values ('COLL-AFTER', rpc_my_name() || '|' || account_name('${COLL}') || '|'
    || (select name from player where world_id = w and uid = '${COLL}'));
  ${tried('COLL-OTHER', "rpc_name_case('Hild')")}
  ${tried('COLL-SHAPE', "rpc_name_case('C0ll!')")}
  begin
    update account set display = 'Bran' where uid = '${COLL}';
    insert into said values ('TABLE', 'kept');
  exception when others then insert into said values ('TABLE', 'refused: ' || sqlerrm);
  end;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check('the capitals written at sign-up are the name the island hands back', at('MIRA') === 'MiRa', at('MIRA'));
check('and the name everybody is shown', at('MIRA-SHOWN') === 'MiRa', at('MIRA-SHOWN'));
check('capitals that are not the account\'s own letters are not kept', at('BRAN') === 'bran', at('BRAN'));
check('an account with none is its letters, as before', at('COLL') === 'coll', at('COLL'));
check('an account may change its capitals', at('COLL-CASED') === 'Coll', at('COLL-CASED'));
check('and is that name everywhere at once: handed back, shown, and on the island it is on',
  at('COLL-AFTER') === 'Coll|Coll|Coll', at('COLL-AFTER'));
check('but not its letters', at('COLL-OTHER') === 'refused: Only the capitals can change: coll is the name.', at('COLL-OTHER'));
check('nor into a shape a name may not have', at('COLL-SHAPE').startsWith('refused: Only the capitals can change'), at('COLL-SHAPE'));
check('and the table itself keeps only a casing of the name', at('TABLE').startsWith('refused:') && at('TABLE').includes('account_display_folds'), at('TABLE'));

/* ---- in the browser ---------------------------------------------------------------- */

check('the browser keeps the capitals as written', writtenName('  MiRa ') === 'MiRa', writtenName('  MiRa '));
check('and signs in with the letters folded, so MiRa and mira are one account',
  foldName('MiRa') === 'mira' && nameEmail('MiRa') === nameEmail('mira'), nameEmail('MiRa'));
check('a name with capitals is a name', nameTrouble('MiRa') === null && nameTrouble('Bran_9') === null, `${nameTrouble('MiRa')} ${nameTrouble('Bran_9')}`);
check('and the shapes the island refuses, the browser refuses too',
  nameTrouble('C0ll!') === 'Letters, numbers, underscore and hyphen only.' && nameTrouble('Koll') === 'Letters, numbers, underscore and hyphen only.'
    && nameTrouble('9lives') === 'Start it with a letter.', `${nameTrouble('C0ll!')} | ${nameTrouble('Koll')} | ${nameTrouble('9lives')}`);
const page = readFileSync('src/account.ts', 'utf8');
check('the name box no longer folds what you type', !/nameBox\.value\.toLowerCase\(\)/.test(page) && page.includes("nameBox.addEventListener('input', () => checkName());"));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na name as you write it — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
