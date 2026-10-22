/**
 * The doors: what a browser's roles may do to the island without going through an `rpc_*`.
 *
 * Supabase's security advisors, as a test that runs on every push:
 *
 *   * every table in `public` has row level security;
 *   * every SECURITY DEFINER function in `public` has a fixed search_path;
 *   * anon and authenticated hold nothing on a table or view in `public` but SELECT (no INSERT, UPDATE,
 *     DELETE, TRUNCATE, REFERENCES, TRIGGER, column grants included);
 *   * no function in `public` but an `rpc_*` is executable by anon or authenticated, and anon only `rpc_name_free`;
 *   * `private.lock_doors()` run again takes no ACCESS EXCLUSIVE lock, and puts back a door left open;
 *   * two islands, two players on each and a third on one: nobody reads a row of an island they are not on, from
 *     any table with a `world_id`, and a deal is read only by its two sides;
 *   * `rpc_name_free` answers 20 a minute per client IP, then "Too many requests: wait N s.", and a call with no IP
 *     header counts against one bucket for all such calls.
 *
 * Makes its own islands and rolls them back.
 */
import { execFileSync } from 'node:child_process';

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

/** The only calls a visitor with no account may make. */
const ANON_RPCS = ['rpc_name_free'];
/** rpc_name_free, calls a minute per client IP. */
const NAME_FREE_MOST = 20;

const A = 'd0040000-0000-4000-8000-00000000000a'; // on Doorhold
const A2 = 'd0040000-0000-4000-8000-0000000000a2'; // on Doorhold, the other side of A's deal
const C = 'd0040000-0000-4000-8000-00000000000c'; // on Doorhold, no side of any deal
const B = 'd0040000-0000-4000-8000-00000000000b'; // on Doorsend
const B2 = 'd0040000-0000-4000-8000-0000000000b2'; // on Doorsend

const PRIVS = `array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
  || case when current_setting('server_version_num')::int >= 170000 then array['MAINTAIN'] else '{}'::text[] end`;
const ROLES = `array['anon', 'authenticated']`;
const PUBLIC_RELS = `from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'`;
const PUBLIC_FNS = `from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
grant all on said to anon, authenticated;

-- ---------------------------------------------------------------- the advisors
insert into said select 'NORLS', coalesce(string_agg(c.relname, ',' order by c.relname), '')
  ${PUBLIC_RELS} where c.relkind in ('r', 'p') and not c.relrowsecurity;
insert into said select 'NOPATH', coalesce(string_agg(p.oid::regprocedure::text, ',' order by 1), '')
  ${PUBLIC_FNS} where p.prosecdef
   and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) s where s like 'search\\_path=%');
-- And every other function of the island too, as the advisors read it (\`function_search_path_mutable\`): an
-- extension's own excepted, which the advisors skip.
insert into said select 'MUTABLE', coalesce(string_agg(p.oid::regprocedure::text, ',' order by 1), '')
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace
 where s.nspname in ('public', 'private') and p.prokind in ('f', 'p')
   and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
   and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search\\_path=%');
insert into said select 'PRIVS', coalesce(string_agg(distinct r || ':' || pr || ':' || c.relname, ',' order by r || ':' || pr || ':' || c.relname), '')
  ${PUBLIC_RELS}, unnest(${ROLES}) r, unnest(${PRIVS}) pr
 where c.relkind in ('r', 'p', 'v', 'm', 'f') and (has_table_privilege(r, c.oid, pr)
    or (pr in ('INSERT', 'UPDATE', 'REFERENCES') and has_any_column_privilege(r, c.oid, pr)));
insert into said select 'FNS', coalesce(string_agg(distinct p.oid::regprocedure::text, ',' order by p.oid::regprocedure::text), '')
  ${PUBLIC_FNS} where p.proname not like 'rpc\\_%'
   and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
insert into said select 'ANONFNS', coalesce(string_agg(distinct p.proname, ',' order by p.proname), '')
  ${PUBLIC_FNS} where has_function_privilege('anon', p.oid, 'execute')
   and p.proname <> all (array[${ANON_RPCS.map((f) => `'${f}'`).join(', ')}]);
insert into said select 'RPCS', count(*)::text
  ${PUBLIC_FNS} where p.proname like 'rpc\\_%' and not has_function_privilege('authenticated', p.oid, 'execute');

-- ---------------------------------------------------------------- lock_doors, again
select private.lock_doors() \\g /dev/null
insert into said select 'LOCKS', count(*)::text from pg_locks l join pg_class c on c.oid = l.relation
 where l.pid = pg_backend_pid() and l.mode = 'AccessExclusiveLock' and c.relnamespace = 'public'::regnamespace;
-- A door left open, by hand, on a table with an island and on one without.
grant references, trigger, truncate on public.creature to anon, authenticated;
grant insert (name) on public.creature to authenticated;
grant trigger on public.item_def to public;
alter table public.deal disable row level security;
select private.lock_doors() \\g /dev/null
insert into said select 'SHUT', coalesce(string_agg(distinct r || ':' || pr || ':' || c.relname, ','), '')
  ${PUBLIC_RELS}, unnest(${ROLES}) r, unnest(${PRIVS}) pr
 where c.relname in ('creature', 'item_def') and (has_table_privilege(r, c.oid, pr)
    or (pr in ('INSERT', 'UPDATE', 'REFERENCES') and has_any_column_privilege(r, c.oid, pr)));
insert into said select 'DEALRLS', relrowsecurity::text from pg_class where oid = 'public.deal'::regclass;

-- ---------------------------------------------------------------- two islands
do $t$
declare w1 uuid; w2 uuid;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Doorhold', 191, 40, 16, 16, true) returning id into w1;
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Doorsend', 192, 40, 16, 16, true) returning id into w2;
  perform land_blank(w1, 40);
  perform land_blank(w2, 40);
  perform set_config('request.jwt.claims', json_build_object('sub', '${A}')::text, true);  perform rpc_join(w1, 'Adda');
  perform set_config('request.jwt.claims', json_build_object('sub', '${A2}')::text, true); perform rpc_join(w1, 'Aldo');
  perform set_config('request.jwt.claims', json_build_object('sub', '${C}')::text, true);  perform rpc_join(w1, 'Cato');
  perform set_config('request.jwt.claims', json_build_object('sub', '${B}')::text, true);  perform rpc_join(w2, 'Bram');
  perform set_config('request.jwt.claims', json_build_object('sub', '${B2}')::text, true); perform rpc_join(w2, 'Bets');
  insert into auth.users (id) values ('${A}'), ('${A2}'), ('${C}'), ('${B}'), ('${B2}') on conflict do nothing;
  insert into account (uid, name) values ('${A}', 'doorsadda'), ('${A2}', 'doorsaldo'), ('${C}', 'doorscato'),
    ('${B}', 'doorsbram'), ('${B2}', 'doorsbets') on conflict do nothing;
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex) values
    (w1, 9401, 'shaggan', 'Shaggan', 'wild', 10.5, 10.5, 10.5, 10.5, 90, 'female'),
    (w2, 9402, 'shaggan', 'Shaggan', 'wild', 10.5, 10.5, 10.5, 10.5, 90, 'female');
  insert into deal (world_id, seller, buyer, want) values (w1, '${A}', '${A2}', 8), (w2, '${B}', '${B2}', 8);
  insert into crate (world_id, id, kind, x, y, sx, sy, made_by) values (w1, 9401, 'plank', 5, 5, 0, 0, '${A}'), (w2, 9402, 'plank', 5, 5, 0, 0, '${B}');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w1, 'Ahold', 20, 20, 5, 1, '${A}'), (w2, 'Bhold', 20, 20, 5, 1, '${B}');
  insert into event (world_id, uid, text) values (w1, null, 'to Doorhold'), (w2, null, 'to Doorsend'), (w2, '${B}', 'to Bram');
  perform set_config('my.w1', w1::text, false);
  perform set_config('my.w2', w2::text, false);
end $t$;

-- What the island holds on Doorsend, counted by its owner, for every table with an island on it.
create temp table there (t text, n bigint);
grant all on there to anon, authenticated;
do $t$
declare r record; v bigint;
begin
  for r in select c.relname ${PUBLIC_RELS} where c.relkind in ('r', 'p', 'v', 'm')
             and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'world_id' and not a.attisdropped)
  loop
    execute format('select count(*) from public.%I where world_id = $1', r.relname) into v using current_setting('my.w2')::uuid;
    insert into there values (r.relname, v);
  end loop;
end $t$;
insert into said select 'THERE', count(*) filter (where n > 0) || '|' || coalesce(string_agg(t, ',' order by t) filter (where t in ('creature', 'deal', 'crate', 'deed', 'event', 'player', 'account') and n > 0), '') from there;

-- As somebody on Doorhold, and as nobody at all: what of Doorsend comes back.
create temp table seen (who text, t text, n bigint);
grant all on seen to anon, authenticated;
select set_config('my.who', 'A', false) \\g /dev/null
select set_config('request.jwt.claims', json_build_object('sub', '${A}')::text, false) \\g /dev/null
set role authenticated;
do $t$
declare r record; v bigint;
begin
  for r in select t from there where n > 0 loop
    if has_table_privilege('authenticated', ('public.' || r.t)::regclass, 'select') then
      execute format('select count(*) from public.%I where world_id = $1', r.t) into v using current_setting('my.w2')::uuid;
      insert into seen values (current_setting('my.who'), r.t, v);
    end if;
  end loop;
end $t$;
insert into said select 'A:creature', count(*)::text from creature where world_id = current_setting('my.w1')::uuid;
insert into said select 'A:deal', count(*)::text from deal where world_id = current_setting('my.w1')::uuid;
insert into said select 'A:crate', count(*)::text from crate where world_id = current_setting('my.w1')::uuid;
insert into said select 'A:deed', count(*)::text from deed where world_id = current_setting('my.w1')::uuid;
insert into said select 'A:event', count(*)::text from event where world_id = current_setting('my.w1')::uuid and uid is null and text = 'to Doorhold';
insert into said select 'A:account', coalesce(string_agg(name, ',' order by name), '') from account where name like 'doors%';
insert into said select 'A:player', count(*)::text from player where world_id = current_setting('my.w1')::uuid;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '${C}')::text, false) \\g /dev/null
set role authenticated;
insert into said select 'C:deal', count(*)::text from deal;
insert into said select 'C:creature', count(*)::text from creature where world_id = current_setting('my.w1')::uuid;
reset role;

select set_config('my.who', 'anon', false) \\g /dev/null
select set_config('request.jwt.claims', '', false) \\g /dev/null
set role anon;
do $t$
declare r record; v bigint;
begin
  for r in select t from there where n > 0 loop
    if has_table_privilege('anon', ('public.' || r.t)::regclass, 'select') then
      execute format('select count(*) from public.%I where world_id in ($1, $2)', r.t) into v
        using current_setting('my.w1')::uuid, current_setting('my.w2')::uuid;
      insert into seen values (current_setting('my.who'), r.t, v);
    end if;
  end loop;
end $t$;
reset role;
insert into said select 'SEEN:' || who, count(*) || '|' || coalesce(string_agg(t || '=' || n, ',' order by t) filter (where n > 0), '')
  from seen group by who;

-- ---------------------------------------------------------------- rpc_name_free
do $t$ begin if to_regclass('private.name_free_ask') is not null then delete from private.name_free_ask; end if; end $t$;
select set_config('request.headers', '{"x-forwarded-for": "203.0.113.7, 10.0.0.1"}', false) \\g /dev/null
set role anon;
do $t$
declare i int; v_ok int := 0; v_err text := '';
begin
  for i in 1..${NAME_FREE_MOST} loop
    begin perform rpc_name_free('doorsnobody'); v_ok := v_ok + 1; exception when others then v_err := sqlerrm; end;
  end loop;
  begin perform rpc_name_free('doorsnobody'); exception when others then v_err := sqlerrm; end;
  insert into said values ('ASK:ip', v_ok || '|' || v_err);
end $t$;
reset role;
select set_config('request.headers', '{"x-forwarded-for": "198.51.100.9"}', false) \\g /dev/null
set role anon;
do $t$
declare v text;
begin
  begin v := rpc_name_free('doorsnobody')::text; exception when others then v := sqlerrm; end;
  insert into said values ('ASK:other', v);
end $t$;
reset role;
select set_config('request.headers', '', false) \\g /dev/null
set role anon;
do $t$
declare i int; v_ok int := 0; v_err text := '';
begin
  for i in 1..${NAME_FREE_MOST + 1} loop
    begin perform rpc_name_free('doorsnobody'); v_ok := v_ok + 1; exception when others then v_err := sqlerrm; end;
  end loop;
  insert into said values ('ASK:none', v_ok || '|' || v_err);
end $t$;
reset role;
do $t$ begin
  if to_regclass('private.name_free_ask') is not null then
    execute $q$insert into said select 'ASKROWS', count(*) || '|' || coalesce(max(slot), -2) || '|' || coalesce(min(slot), -2) from private.name_free_ask$q$;
  end if;
end $t$;

select k || '=' || v from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) said.set(line.slice(0, i), line.slice(i + 1));
}
const none = (k: string): [boolean, string] => [said.get(k) === '', said.get(k) || 'none'];

check('every table in public has row level security', ...none('NORLS'));
check('every SECURITY DEFINER function in public has a fixed search_path', ...none('NOPATH'));
check('and every function of the island, an extension\'s own excepted, has one', ...none('MUTABLE'));
check('anon and authenticated hold nothing on a table or view but SELECT', ...none('PRIVS'));
check('no function but an rpc_* is executable by anon or authenticated', ...none('FNS'));
check(`anon may call ${ANON_RPCS.join(', ')} and nothing else`, ...none('ANONFNS'));
check('every rpc_* is executable by authenticated', said.get('RPCS') === '0', said.get('RPCS'));
check('lock_doors run again takes no ACCESS EXCLUSIVE lock', said.get('LOCKS') === '0', `${said.get('LOCKS')} taken`);
check('lock_doors takes back REFERENCES, TRIGGER, TRUNCATE and a column INSERT, from anon, authenticated and public', ...none('SHUT'));
check('lock_doors turns row level security back on', said.get('DEALRLS') === 'true', said.get('DEALRLS'));

{
  const [n, which] = (said.get('THERE') ?? '').split('|');
  check('Doorsend has rows in the tables the test reads across', Number(n) >= 7 && which === 'crate,creature,deal,deed,event,player',
    `${n} tables, ${which}`);
}
{
  const [n, open] = (said.get('SEEN:A') ?? '|').split('|');
  check('somebody on Doorhold reads not one row of Doorsend, from any table with an island', Number(n) >= 7 && open === '', `${n} tables read, ${open || 'none open'}`);
  const [m, anonOpen] = (said.get('SEEN:anon') ?? '0|').split('|');
  check('a visitor with no account reads not one row of either island', anonOpen === '', `${m} tables readable, ${anonOpen || 'none open'}`);
}
check('the wildermon of one\'s own island are read', said.get('A:creature') === '1', said.get('A:creature'));
check('a deal is read by its side', said.get('A:deal') === '1', said.get('A:deal'));
check('and not by a third body on the same island', said.get('C:deal') === '0', said.get('C:deal'));
check('who is not a side still reads the island\'s wildermon', said.get('C:creature') === '1', said.get('C:creature'));
check('crates and settlements of one\'s own island are read', said.get('A:crate') === '1' && said.get('A:deed') === '1', `${said.get('A:crate')} crate, ${said.get('A:deed')} deed`);
check('a line said to one\'s island is read', said.get('A:event') === '1', said.get('A:event'));
check('the names read are of one\'s own islands', said.get('A:account') === 'doorsadda,doorsaldo,doorscato', said.get('A:account'));
check('the bodies of one\'s own island are read', said.get('A:player') === '3', said.get('A:player'));

const refusal = /^Too many requests: wait \d+ s\.$/;
{
  const [n, err] = (said.get('ASK:ip') ?? '|').split('|');
  check(`${NAME_FREE_MOST} name checks a minute from one IP are answered`, n === String(NAME_FREE_MOST), `${n} answered`);
  check(`the ${NAME_FREE_MOST + 1}st is refused in one short line`, refusal.test(err ?? ''), err);
}
check('another IP is answered meanwhile', said.get('ASK:other') === 'true', said.get('ASK:other'));
{
  const [n, err] = (said.get('ASK:none') ?? '|').split('|');
  check(`calls with no IP share one bucket of ${NAME_FREE_MOST}`, n === String(NAME_FREE_MOST) && refusal.test(err ?? ''), `${n} answered, then ${err}`);
}
{
  const [rows, hi, lo] = (said.get('ASKROWS') ?? '').split('|');
  check('a bucket a slot, the slots bounded', rows === '3' && Number(hi) < 4096 && lo === '-1', `${rows} rows, slots ${lo}..${hi}`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthe doors — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
