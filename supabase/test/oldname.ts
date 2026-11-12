/**
 * The former name, out of the island (`20261111235900_wildermon_by_name.sql`).
 *
 * The database the suite builds holds nothing of it, since the migrations were edited to match; the island was
 * built from the earlier text. So this plants the earlier shapes in the suite's database, inside a transaction it
 * rolls back, runs the migration over them, and asks:
 *
 *   * an account under the old `.invalid` suffix is at `@catgenova.github.io` afterwards, in `auth.users` and in
 *     `auth.identities`, keeps its uid, and is the name it was: `name_email` gives the address it now has,
 *     `email_name` reads it back, `rpc_my_name` answers it, and `name_domains()` holds the current suffix alone;
 *   * a function's settings and headers read `wildermon.*` and `x-wildermon-*`, and its comment the new name, case
 *     kept; a view, a column default, a check, a policy, a trigger's condition, comments on a table and a column,
 *     a role setting, and rows of text, json and text arrays, the same;
 *   * nothing in the database holds the word afterwards (`pg_temp.old_name_left`), and the migration said so;
 *   * run again, it changes nothing;
 *   * an account whose own name holds the word stops it before anything changes.
 *
 *   npx esbuild supabase/test/oldname.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/oldname.mjs && node node_modules/.cache/oldname.mjs
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const MIGRATION = resolve(process.cwd(), 'supabase/migrations/20261111235900_wildermon_by_name.sql');
const env = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
  PGPORT: process.env.PGPORT ?? '5433',
  PGUSER: process.env.PGUSER ?? 'wildermon',
  PGDATABASE: process.env.PGDATABASE ?? 'postgres',
};
const psql = (sql: string): { out: string; err: string; status: number } => {
  const r = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], { input: sql, encoding: 'utf8', env });
  return { out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim(), status: r.status ?? -1 };
};

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

// The former name, made the way the migration makes it: from bytes, so this file does not spell it.
const OLD = Buffer.from('7775726d', 'hex').toString('utf8');
const CAP = OLD[0].toUpperCase() + OLD.slice(1);
const UID = '7a7a7a7a-7a7a-7a7a-7a7a-7a7a7a7a7a7a';
const lit = (s: string): string => `'${s.replace(/'/g, "''")}'`;

const PLANT = `
reset role;
insert into auth.users (id, email, raw_user_meta_data)
  values ('${UID}', ${lit(`oldtimer@players.${OLD}.invalid`)}, ${lit(JSON.stringify({ email: `oldtimer@players.${OLD}.invalid` }))});
insert into auth.identities (provider_id, user_id, identity_data, provider)
  values ('${UID}', '${UID}', ${lit(JSON.stringify({ sub: UID, email: `oldtimer@players.${OLD}.invalid` }))}, 'email');
create function public.oldname_probe() returns text language plpgsql as $f$
begin
  -- ${CAP} style, ${OLD.toUpperCase()} loud.
  perform set_config(${lit(`${OLD}.season`)}, 'spring', true);
  return current_setting(${lit(`${OLD}.season`)}, true) || ' ' || ${lit(`x-${OLD}-seat`)};
end $f$;
create view public.oldname_view as select ${lit(CAP)}::text as said;
create table public.oldname_t (
  id int primary key,
  note text default ${lit(`${OLD}-note`)} check (note <> ${lit(`${OLD}-forbidden`)}),
  meta jsonb,
  tags text[]
);
alter table public.oldname_t enable row level security;
create policy oldname_p on public.oldname_t using (note <> ${lit(`${OLD}-hidden`)});
create function public.oldname_trg() returns trigger language plpgsql as $f$ begin return new; end $f$;
create trigger oldname_w before update on public.oldname_t
  for each row when (new.note is distinct from ${lit(`${OLD}-when`)}) execute function public.oldname_trg();
comment on table public.oldname_t is ${lit(`${CAP} table`)};
comment on column public.oldname_t.note is ${lit(`the ${OLD} note`)};
insert into public.oldname_t values
  (1, ${lit(`${CAP} and ${OLD.toUpperCase()} and ${OLD}`)}, ${lit(JSON.stringify({ k: `${OLD}.season` }))}, array[${lit(OLD)}]),
  (2, 'plain', '{}', '{}');
do $d$ begin execute format('alter role %I in database %I set ${OLD}.probe = %L', current_user, current_database(), ${lit(`${OLD}-value`)}); end $d$;
`;

const ASK = `
select 'email=' || email from auth.users where id = '${UID}';
select 'meta=' || (raw_user_meta_data ->> 'email') from auth.users where id = '${UID}';
select 'identity=' || (identity_data ->> 'email') || ' ' || email from auth.identities where user_id = '${UID}';
select 'name_email=' || name_email('Oldtimer') || ' email_name=' || coalesce(email_name('oldtimer@catgenova.github.io'), 'nothing');
select 'domains=' || array_to_string(name_domains(), ',');
select set_config('request.jwt.claims', json_build_object('sub', '${UID}')::text, true) \\g /dev/null
select 'my_name=' || coalesce(rpc_my_name(), 'NAMELESS');
select set_config('request.jwt.claims', '', true) \\g /dev/null
select 'probe=' || public.oldname_probe();
select 'probe_src=' || replace(prosrc, E'\\n', ' ') from pg_proc where proname = 'oldname_probe';
select 'view=' || said from public.oldname_view;
select 'default=' || pg_get_expr(d.adbin, d.adrelid) from pg_attrdef d where d.adrelid = 'public.oldname_t'::regclass;
select 'check=' || pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid = 'public.oldname_t'::regclass and c.contype = 'c';
select 'policy=' || pg_get_expr(polqual, polrelid) from pg_policy where polname = 'oldname_p';
select 'trigger=' || pg_get_triggerdef(oid) from pg_trigger where tgname = 'oldname_w';
select 'comment=' || obj_description('public.oldname_t'::regclass, 'pg_class') || ' / ' || col_description('public.oldname_t'::regclass, 3);
select 'row=' || note || ' ' || meta::text || ' ' || tags::text from public.oldname_t where id = 1;
select 'setting=' || array_to_string(setconfig, ',') from pg_db_role_setting
 where setrole = current_user::regrole and setdatabase = (select oid from pg_database where datname = current_database());
select 'left=' || count(*) from pg_temp.old_name_left() where firm;
`;

const run = psql(`begin;\n${PLANT}\n\\i ${MIGRATION}\n${ASK}\n\\i ${MIGRATION}\nrollback;\n`);
const said = new Map<string, string>();
for (const line of run.out.split('\n')) {
  const at = line.indexOf('=');
  if (at > 0 && !said.has(line.slice(0, at))) said.set(line.slice(0, at), line.slice(at + 1));
}
const get = (k: string): string => said.get(k) ?? '';
const clean = (s: string): boolean => !s.toLowerCase().includes(OLD);

check('the migration runs over the planted shapes, twice', run.status === 0, run.status === 0 ? '' : run.err.slice(-600));
check('the account is at the current suffix', get('email') === 'oldtimer@catgenova.github.io', get('email'));
check('and its metadata', get('meta') === 'oldtimer@catgenova.github.io', get('meta'));
check('and its identity, data and worked-out address', get('identity') === 'oldtimer@catgenova.github.io oldtimer@catgenova.github.io', get('identity'));
check('the address it signs in with is the address it has, and reads back as the name',
  get('name_email') === 'oldtimer@catgenova.github.io email_name=oldtimer', get('name_email'));
check('the island answers to the current suffix alone', get('domains') === '@catgenova.github.io', get('domains'));
check('signed in by uid, it is still oldtimer', get('my_name') === 'oldtimer', get('my_name'));
check('a function sets and reads wildermon.*, and names x-wildermon-seat',
  get('probe') === 'spring x-wildermon-seat', get('probe'));
check('its comment, case kept', get('probe_src').includes('Wildermon style, WILDERMON loud.') && clean(get('probe_src')), get('probe_src'));
check('a view', get('view') === 'Wildermon', get('view'));
check('a column default', get('default').includes('wildermon-note') && clean(get('default')), get('default'));
check('a check', get('check').includes('wildermon-forbidden') && clean(get('check')), get('check'));
check('a policy', get('policy').includes('wildermon-hidden') && clean(get('policy')), get('policy'));
check('a trigger\'s condition', get('trigger').includes('wildermon-when') && clean(get('trigger')), get('trigger'));
check('comments on a table and a column', get('comment') === 'Wildermon table / the wildermon note', get('comment'));
check('rows of text, json and arrays', get('row') === 'Wildermon and WILDERMON and wildermon {"k": "wildermon.season"} {wildermon}', get('row'));
check('a role setting', get('setting').includes('wildermon.probe=wildermon-value') && clean(get('setting')), get('setting'));
check('nothing left holding the word', get('left') === '0', get('left'));
const notices = run.err.split('\n').filter((l) => l.includes('Renamed:'));
check('the migration says what it renamed: one account, one identity',
  /"accounts moved": 1\b/.test(notices[0] ?? '') && /"identities moved": 1\b/.test(notices[0] ?? ''), notices[0]);
check('run again, it renames nothing',
  /"accounts moved": 0\b/.test(notices[1] ?? '') && /"functions": 0\b/.test(notices[1] ?? '') && /"rows": 0\b/.test(notices[1] ?? ''), notices[1]);
check('and says nothing is left', run.err.includes('Nothing on the island holds the old word.'));

const named = psql(`begin;
reset role;
insert into auth.users (id, email) values ('7b7b7b7b-7b7b-7b7b-7b7b-7b7b7b7b7b7b', ${lit(`my${OLD}fan@catgenova.github.io`)});
create function public.oldname_probe() returns text language sql as $f$ select ${lit(`${OLD}.x`)} $f$;
\\i ${MIGRATION}
rollback;
`);
check('an account whose own name holds the word stops it, nothing changed',
  named.status !== 0 && named.err.includes('Not renamed: 1 account(s)'), named.err.slice(-300));

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
