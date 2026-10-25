/**
 * Permissions: what a browser's two roles may do, held to a list somebody has read (`permissions.allow.ts`).
 *
 * As the roles themselves, `anon` and `authenticated` (a JWT's claims set the way the doors read them):
 *
 *   * every table and view in public is in the list, and the list names nothing that is not there: a new one
 *     fails here until somebody writes down who reads it;
 *   * each reads on exactly the terms written down: nothing, every row, its policy (word for word), or through a
 *     security_invoker view; a view that reads as its owner, a table without row level security, a policy for
 *     any command but SELECT, fail;
 *   * neither may insert, update, delete or truncate any of them: tried, and refused for want of the privilege;
 *   * somebody signed in and on no island, and somebody not signed in, read not one row of any table but the
 *     rulebook's, with an island and a body on it to read; but for the front door's island (`home`), which
 *     somebody signed in reads, and somebody not signed in does not;
 *   * the functions each may execute, in public and private, are exactly the list's: a new `rpc_*` fails here
 *     until it is written down; and every other function, called as each role, is refused for want of EXECUTE;
 *   * every SECURITY DEFINER function in public and private fixes its search_path, and none of the schemas it
 *     can name is one a browser's role may create in;
 *   * neither holds anything on a sequence in public, or on a table in private;
 *   * schema USAGE and the policies on `realtime.messages` are the list's.
 *
 * Makes an island of its own and rolls it back.
 *
 *   npx esbuild supabase/test/permissions.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/permissions.mjs && node node_modules/.cache/permissions.mjs
 */
import { execFileSync } from 'node:child_process';
import { EXECUTE, REALTIME_POLICIES, SCHEMA_USAGE, TABLES, type Read } from './permissions.allow';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
      PGCLIENTENCODING: 'UTF8',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const listed = (xs: readonly string[]): string => (xs.length ? xs.join(', ') : 'none');

const ROLES = ['anon', 'authenticated'] as const;
type Role = (typeof ROLES)[number];
/** Schemas the island owns. Supabase's own (auth, realtime, storage and the rest) are Supabase's to keep. */
const OURS = ['public', 'private'];

const ON = 'e7470000-0000-4000-8000-00000000000a'; // on Permrock
const OFF = 'e7470000-0000-4000-8000-00000000000b'; // signed in, on no island

const out = psql(`
discard temp;
begin;
create temp table said (k text, v jsonb);
grant all on said to anon, authenticated;

-- ---------------------------------------------------------------- what the catalogue says
insert into said select 'rels', coalesce(jsonb_agg(jsonb_build_object(
    'name', c.relname, 'kind', c.relkind, 'rls', c.relrowsecurity,
    'invoker', coalesce(c.reloptions @> array['security_invoker=true'] or c.reloptions @> array['security_invoker=on'], false),
    'select', jsonb_build_object('anon', has_any_column_privilege('anon', c.oid, 'select'),
                                 'authenticated', has_any_column_privilege('authenticated', c.oid, 'select')),
    -- Columns granted one by one, where the table is not granted whole.
    'cols', jsonb_build_object(
      'anon', case when not has_table_privilege('anon', c.oid, 'select') then (select coalesce(jsonb_agg(a.attname order by a.attnum), '[]')
        from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped and has_column_privilege('anon', c.oid, a.attnum, 'select')) end,
      'authenticated', case when not has_table_privilege('authenticated', c.oid, 'select') then (select coalesce(jsonb_agg(a.attname order by a.attnum), '[]')
        from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped and has_column_privilege('authenticated', c.oid, a.attnum, 'select')) end),
    'policies', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', p.polname, 'cmd', p.polcmd::text, 'permissive', p.polpermissive,
        'roles', (select coalesce(jsonb_agg(case when r = 0 then 'public' else r::regrole::text end order by 1), '[]') from unnest(p.polroles) r),
        'using', pg_get_expr(p.polqual, p.polrelid), 'check', pg_get_expr(p.polwithcheck, p.polrelid)) order by p.polname), '[]')
      from pg_policy p where p.polrelid = c.oid)
  ) order by c.relname), '[]')
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f');

insert into said select 'exec', coalesce(jsonb_agg(jsonb_build_object('fn', p.oid::regprocedure::text, 'role', r) order by 1), '[]')
  from pg_proc p, unnest(array['anon', 'authenticated']) r
 where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
   and has_function_privilege(r, p.oid, 'execute');

insert into said select 'nopath', coalesce(jsonb_agg(p.oid::regprocedure::text order by 1), '[]')
  from pg_proc p where p.prosecdef and p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
   and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) s where s like 'search\\_path=%');
insert into said select 'paths', coalesce(jsonb_agg(distinct s), '[]')
  from pg_proc p, unnest(p.proconfig) s
 where p.prosecdef and p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and s like 'search\\_path=%';
insert into said select 'create', coalesce(jsonb_agg(n.nspname || ':' || r order by 1), '[]')
  from pg_namespace n, unnest(array['anon', 'authenticated', 'public']) r
 where n.nspname not like 'pg\\_%' and n.nspname <> 'information_schema'
   and case when r = 'public'
            then exists (select 1 from aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a where a.grantee = 0 and a.privilege_type = 'CREATE')
            else has_schema_privilege(r, n.oid, 'create') end;
insert into said select 'usage', coalesce(jsonb_agg(n.nspname || ':' || r order by 1), '[]')
  from pg_namespace n, unnest(array['anon', 'authenticated']) r
 where n.nspname = any (array[${OURS.map((s) => `'${s}'`).join(', ')}]) and has_schema_privilege(r, n.oid, 'usage');
insert into said select 'seqs', coalesce(jsonb_agg(c.relname || ':' || r order by 1), '[]')
  from pg_class c, unnest(array['anon', 'authenticated']) r
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
   and has_sequence_privilege(r, c.oid, 'usage, select, update');
insert into said select 'privtabs', coalesce(jsonb_agg(c.relname || ':' || r order by 1), '[]')
  from pg_class c, unnest(array['anon', 'authenticated']) r
 where c.relnamespace = 'private'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
   and has_table_privilege(r, c.oid, 'select, insert, update, delete, truncate, references, trigger');
insert into said select 'realtime', coalesce(jsonb_agg(jsonb_build_object('name', p.polname, 'cmd', p.polcmd::text,
    'roles', (select coalesce(jsonb_agg(case when r = 0 then 'public' else r::regrole::text end order by 1), '[]') from unnest(p.polroles) r),
    'using', pg_get_expr(p.polqual, p.polrelid), 'check', pg_get_expr(p.polwithcheck, p.polrelid)) order by p.polname), '[]')
  from pg_policy p where to_regclass('realtime.messages') is not null and p.polrelid = to_regclass('realtime.messages');

-- ---------------------------------------------------------------- an island, with a body and its things on it
do $t$
declare w uuid;
begin
  insert into auth.users (id) values ('${ON}'), ('${OFF}') on conflict do nothing;
  insert into account (uid, name) values ('${ON}', 'permson') on conflict do nothing;
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Permrock', 472, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform set_config('request.jwt.claims', json_build_object('sub', '${ON}')::text, true);
  perform rpc_join(w, 'Permson');
  perform rpc_say(w, 'Heard by the island');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Permstead', 20, 20, 2, 1, '${ON}');
  insert into crate (world_id, id, kind, x, y, sx, sy, made_by) values (w, 4702, 'plank', 5, 5, 0, 0, '${ON}');
  perform creature_spawn(w, 'holla', 10.5, 10.5, 'deed', now() - interval '60 days', '${ON}');
  -- The front door opens on another island: Permrock is not it.
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Permdoor', 473, 8, 4, 4, true) returning id into w;
  update home set island = w;
end $t$;

-- ---------------------------------------------------------------- as each role: try everything
create temp table tried (who text, rel text, op text, res text);
grant all on tried to anon, authenticated;
create temp table rel_list as
  select c.relname, c.relkind,
         (select a.attname from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
             and a.attgenerated = '' and a.attidentity = '' order by a.attnum limit 1) as col
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f');
grant select on rel_list to anon, authenticated;
create temp table fn_list as
  select p.oid, p.oid::regprocedure::text as sig, p.prokind,
         format('%I.%I', n.nspname, p.proname) as qname,
         (select coalesce(string_agg(case when p.provariadic <> 0 and i = p.pronargs then 'variadic ' else '' end
                                     || 'null::' || format_type(t, null), ', ' order by i), '')
            from unnest(p.proargtypes::oid[]) with ordinality u(t, i)) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = any (array[${OURS.map((s) => `'${s}'`).join(', ')}]) and p.prokind in ('f', 'p');
grant select on fn_list to anon, authenticated;
create temp table fn_tried (who text, sig text, res text);
grant all on fn_tried to anon, authenticated;

create function pg_temp.try_all(p_who text) returns void language plpgsql as $f$
declare r record; n bigint;
begin
  for r in select * from rel_list loop
    begin
      execute format('select count(*) from public.%I', r.relname) into n;
      insert into tried values (p_who, r.relname, 'select', n::text);
    exception when insufficient_privilege then insert into tried values (p_who, r.relname, 'select', 'denied');
    end;
    begin
      execute format('insert into public.%I default values', r.relname);
      insert into tried values (p_who, r.relname, 'insert', 'ALLOWED');
    exception when insufficient_privilege then insert into tried values (p_who, r.relname, 'insert', 'denied');
      when others then insert into tried values (p_who, r.relname, 'insert',
        case when sqlstate = '55000' and r.relkind = 'v' then 'denied' else 'ALLOWED: ' || sqlstate end);
    end;
    begin
      execute format('update public.%I set %I = %I where false', r.relname, r.col, r.col);
      insert into tried values (p_who, r.relname, 'update', 'ALLOWED');
    exception when insufficient_privilege then insert into tried values (p_who, r.relname, 'update', 'denied');
      when others then insert into tried values (p_who, r.relname, 'update',
        case when sqlstate = '55000' and r.relkind = 'v' then 'denied' else 'ALLOWED: ' || sqlstate end);
    end;
    begin
      execute format('delete from public.%I where false', r.relname);
      insert into tried values (p_who, r.relname, 'delete', 'ALLOWED');
    exception when insufficient_privilege then insert into tried values (p_who, r.relname, 'delete', 'denied');
      when others then insert into tried values (p_who, r.relname, 'delete',
        case when sqlstate = '55000' and r.relkind = 'v' then 'denied' else 'ALLOWED: ' || sqlstate end);
    end;
    if r.relkind in ('r', 'p') then
      begin
        execute format('truncate public.%I', r.relname);
        insert into tried values (p_who, r.relname, 'truncate', 'ALLOWED');
        raise exception 'undo' using errcode = 'P0001';
      exception when insufficient_privilege then insert into tried values (p_who, r.relname, 'truncate', 'denied');
        when raise_exception then insert into tried values (p_who, r.relname, 'truncate', 'ALLOWED');
        when others then insert into tried values (p_who, r.relname, 'truncate', 'ALLOWED: ' || sqlstate);
      end;
    end if;
  end loop;
end $f$;

-- Every function this role may not execute, called: the refusal must be for want of EXECUTE.
create function pg_temp.call_all(p_who text, p_may text[]) returns void language plpgsql as $f$
declare r record;
begin
  for r in select * from fn_list where sig <> all (p_may) loop
    begin
      if r.prokind = 'p' then execute format('call %s(%s)', r.qname, r.args);
      else execute format('select %s(%s)', r.qname, r.args); end if;
      insert into fn_tried values (p_who, r.sig, 'ALLOWED');
      raise exception 'undo' using errcode = 'P0001';
    exception when insufficient_privilege then null;
      when raise_exception then null;
      when others then insert into fn_tried values (p_who, r.sig, 'ALLOWED: ' || sqlstate);
    end;
  end loop;
end $f$;
grant execute on function pg_temp.try_all(text) to anon, authenticated;
grant execute on function pg_temp.call_all(text, text[]) to anon, authenticated;

select set_config('request.jwt.claims', json_build_object('sub', '${OFF}')::text, false) \\g /dev/null
set role authenticated;
select pg_temp.try_all('authenticated') \\g /dev/null
select pg_temp.call_all('authenticated', array(select f.oid::regprocedure::text from pg_proc f
  where has_function_privilege('authenticated', f.oid, 'execute'))) \\g /dev/null
reset role;
select set_config('request.jwt.claims', '', false) \\g /dev/null
set role anon;
select pg_temp.try_all('anon') \\g /dev/null
select pg_temp.call_all('anon', array(select f.oid::regprocedure::text from pg_proc f
  where has_function_privilege('anon', f.oid, 'execute'))) \\g /dev/null
reset role;

insert into said select 'tried', coalesce(jsonb_agg(jsonb_build_object('who', who, 'rel', rel, 'op', op, 'res', res)), '[]') from tried;
insert into said select 'fntried', coalesce(jsonb_agg(jsonb_build_object('who', who, 'sig', sig, 'res', res)), '[]') from fn_tried;
insert into said select 'fncount', to_jsonb(count(*)) from fn_list;
do $t$
declare r record; n bigint; v text[] := '{}';
begin
  for r in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
             and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'world_id' and not a.attisdropped)
           order by 1 loop
    execute format('select count(*) from (select 1 from public.%I limit 1) x', r.relname) into n;
    if n > 0 then v := v || r.relname::text; end if;
  end loop;
  insert into said values ('there', to_jsonb(v));
end $t$;

select k || '=' || v::text from said;
rollback;
`);

const said = new Map<string, unknown>();
for (const line of out.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && /^[a-z]+$/.test(line.slice(0, i))) said.set(line.slice(0, i), JSON.parse(line.slice(i + 1)));
}

/* ---- tables and views -------------------------------------------------------------------- */

interface Policy { name: string; cmd: string; permissive: boolean; roles: string[]; using: string | null; check: string | null }
interface Rel {
  name: string; kind: string; rls: boolean; invoker: boolean; select: Record<Role, boolean>; cols: Record<Role, string[] | null>; policies: Policy[];
}
const rels = (said.get('rels') ?? []) as Rel[];
const relNames = rels.map((r) => r.name);

/**
 * What a role reads of a relation: 'none', 'all', 'view', the policies' terms joined by OR, or what is wrong; and,
 * where only some columns are granted, which (` [columns: a, b]`).
 */
function reads(r: Rel, role: Role): string {
  const terms = readTerms(r, role);
  const cols = r.cols[role];
  return cols && terms !== 'none' ? `${terms} [columns: ${cols.join(', ')}]` : terms;
}
function readTerms(r: Rel, role: Role): string {
  if (!r.select[role]) return 'none';
  if (r.kind === 'v') return r.invoker ? 'view' : 'VIEW READS AS ITS OWNER';
  if (r.kind === 'm' || r.kind === 'f') return 'ALL ROWS (no row level security on this kind)';
  if (!r.rls) return 'ALL ROWS (row level security off)';
  const mine = r.policies.filter((p) => (p.cmd === 'r' || p.cmd === '*') && p.permissive && (p.roles.includes(role) || p.roles.includes('public')));
  if (!mine.length) return 'none';
  if (mine.some((p) => p.using === 'true')) return 'all';
  return mine.map((p) => p.using ?? 'true').join(' OR ');
}
const want = (x: Read, role: Role): string => {
  if (x === 'rules') return 'all';
  if (x === 'none' || x === 'view') return x;
  return x[role] ?? 'none';
};

{
  const missing = relNames.filter((n) => !(n in TABLES));
  const gone = Object.keys(TABLES).filter((n) => !relNames.includes(n));
  check('every table and view in public is in permissions.allow.ts', missing.length === 0,
    `not listed: ${listed(missing)} (write down who reads each: 'none', 'rules', 'view' or { authenticated: '<policy>' })`);
  check('and the list names nothing that is not there', gone.length === 0, `gone: ${listed(gone)}`);
  check('there are tables and views to read', rels.length > 100, `${rels.length}`);
}
for (const role of ROLES) {
  const off = rels.filter((r) => r.name in TABLES && reads(r, role) !== want(TABLES[r.name], role));
  check(`${role} reads every table and view on exactly the terms written down`, off.length === 0,
    off.map((r) => `${r.name}: reads ${reads(r, role)}, written ${want(TABLES[r.name], role)}`).join('; '));
}
{
  const notSelect = rels.flatMap((r) => r.policies.filter((p) => p.cmd !== 'r').map((p) => `${r.name}.${p.name} (${p.cmd})`));
  check('no policy is for anything but SELECT', notSelect.length === 0, listed(notSelect));
  const restrictive = rels.flatMap((r) => r.policies.filter((p) => !p.permissive).map((p) => `${r.name}.${p.name}`));
  check('no policy is restrictive (the terms above are the whole of them)', restrictive.length === 0, listed(restrictive));
  const noRls = rels.filter((r) => (r.kind === 'r' || r.kind === 'p') && !r.rls).map((r) => r.name);
  check('every table has row level security', noRls.length === 0, listed(noRls));
  const owner = rels.filter((r) => r.kind === 'v' && !r.invoker).map((r) => r.name);
  check('every view reads as whoever reads it (security_invoker)', owner.length === 0, listed(owner));
  const unreadView = Object.entries(TABLES).filter(([, x]) => x === 'view').map(([n]) => n)
    .filter((n) => rels.find((r) => r.name === n)?.kind !== 'v');
  check('only a view is written down as one', unreadView.length === 0, listed(unreadView));
}
{
  const tried = (said.get('tried') ?? []) as Array<{ who: Role; rel: string; op: string; res: string }>;
  check('every table and view was tried, as both roles', tried.filter((t) => t.op === 'select').length === rels.length * 2,
    `${tried.filter((t) => t.op === 'select').length} of ${rels.length * 2}`);
  const wrote = tried.filter((t) => t.op !== 'select' && t.res !== 'denied');
  check('neither role may insert, update, delete or truncate a table or view in public: each refused for want of the privilege',
    wrote.length === 0, wrote.map((t) => `${t.who} ${t.op} ${t.rel}: ${t.res}`).join('; '));
  const selectWrong = tried.filter((t) => t.op === 'select' && (t.res === 'denied') !== !rels.find((r) => r.name === t.rel)?.select[t.who]);
  check('a SELECT is refused exactly where the role holds no SELECT', selectWrong.length === 0,
    selectWrong.map((t) => `${t.who} ${t.rel}: ${t.res}`).join('; '));
  const there = (said.get('there') ?? []) as string[];
  check('the island has rows in the tables read across', ['player', 'item', 'event', 'deed', 'crate', 'creature', 'world_stocked'].filter((t) => !there.includes(t)).length <= 1
    && there.length >= 8, `${there.length}: ${there.join(', ')}`);
  for (const role of ROLES) {
    const leaked = tried.filter((t) => t.who === role && t.op === 'select' && t.res !== 'denied' && t.res !== '0'
      && TABLES[t.rel] !== 'rules' && TABLES[t.rel] !== 'view' && !(role === 'authenticated' && t.rel === 'world' && t.res === '1'));
    check(role === 'anon' ? 'somebody not signed in reads not one row of any table but the rulebook\'s'
      : 'somebody signed in and on no island reads not one row of any table but the rulebook\'s',
    leaked.length === 0, leaked.map((t) => `${t.rel}: ${t.res}`).join('; '));
  }
}

{
  const door = ((said.get('tried') ?? []) as Array<{ who: Role; rel: string; op: string; res: string }>)
    .filter((t) => t.rel === 'world' && t.op === 'select').map((t) => `${t.who}:${t.res}`).sort().join(',');
  check('of the islands, somebody signed in and on none reads the front door\'s alone, and nobody not signed in reads any',
    door === 'anon:denied,authenticated:1', door);
}

/* ---- functions ---------------------------------------------------------------------------- */

{
  const exec = (said.get('exec') ?? []) as Array<{ fn: string; role: Role }>;
  for (const role of ROLES) {
    const has = exec.filter((e) => e.role === role).map((e) => e.fn).sort();
    const may = [...EXECUTE[role]].sort();
    const extra = has.filter((f) => !may.includes(f));
    const lost = may.filter((f) => !has.includes(f));
    check(`${role} may execute exactly the functions written down (${may.length})`, extra.length === 0 && lost.length === 0,
      `${extra.length ? `not written down: ${extra.join(', ')}` : ''}${extra.length && lost.length ? '; ' : ''}${lost.length ? `written down, not executable: ${lost.join(', ')}` : ''}`);
  }
  const anonRpc = EXECUTE.anon.filter((f) => !/^(public\.)?rpc_/.test(f));
  check('anon may execute nothing but an rpc_*', anonRpc.length === 0, listed(anonRpc));
  const publicNotRpc = EXECUTE.authenticated.filter((f) => !f.startsWith('private.') && !/^(public\.)?rpc_/.test(f));
  check('in public, authenticated may execute nothing but an rpc_*', publicNotRpc.length === 0, listed(publicNotRpc));
  const fnTried = (said.get('fntried') ?? []) as Array<{ who: Role; sig: string; res: string }>;
  check(`every other function in ${OURS.join(' and ')} (${said.get('fncount')}), called as each role, is refused for want of EXECUTE`,
    fnTried.length === 0, fnTried.slice(0, 20).map((t) => `${t.who} ${t.sig}: ${t.res}`).join('; '));
  check('every SECURITY DEFINER function fixes its search_path', (said.get('nopath') as string[]).length === 0, listed(said.get('nopath') as string[]));
  const paths = (said.get('paths') ?? []) as string[];
  const named = [...new Set(paths.flatMap((p) => p.replace(/^search_path=/, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean)))];
  const creatable = (said.get('create') ?? []) as string[];
  check('no schema is one a browser\'s role (or PUBLIC) may create in', creatable.length === 0, listed(creatable));
  const foreign = named.filter((s) => !OURS.includes(s) && s !== 'pg_catalog');
  check('and the schemas those search_paths name are the island\'s', foreign.length === 0, listed(foreign));
}

/* ---- the rest -------------------------------------------------------------------------------- */

check('neither role holds anything on a sequence in public', (said.get('seqs') as string[]).length === 0, listed(said.get('seqs') as string[]));
check('nor on a table in private', (said.get('privtabs') as string[]).length === 0, listed(said.get('privtabs') as string[]));
{
  const usage = ((said.get('usage') ?? []) as string[]).sort();
  check('schema USAGE is exactly the list\'s', JSON.stringify(usage) === JSON.stringify([...SCHEMA_USAGE].sort()), listed(usage));
  const rt = (said.get('realtime') ?? []) as Policy[];
  const rtSays = rt.map((p) => `${p.name}:${p.cmd}:${p.roles.join('+')}:${p.using ?? ''}:${p.check ?? ''}`).sort();
  check('the policies on realtime.messages are exactly the list\'s', JSON.stringify(rtSays) === JSON.stringify([...REALTIME_POLICIES].sort()),
    rtSays.join(' | '));
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\npermissions — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
