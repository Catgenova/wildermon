/**
 * The island's doors, as the browser's types: `src/net/rpc.gen.ts`.
 *
 * Reads, from a built database (PGHOST, PGPORT, PGUSER, PGDATABASE as psql
 * takes them), every function in schema `public` named `rpc_*`, and any other
 * function `src` calls through `.rpc('name'`, with its arguments, their
 * defaults and what it returns, and writes them as one `Rpc` map that
 * `src/net/rpc.ts` checks every call against. The read runs in a read-only
 * transaction and changes nothing.
 *
 *   npm run rpc-types            write the file
 *   npm run rpc-types -- --check fail when the file differs from the database
 *
 * An argument with a default is optional, and one whose default is NULL also
 * takes `null`. A jsonb answer is `unknown`: what is in it is read by the
 * decoders in `src/net/rows`, not taken on trust here.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const OUT = join(root, 'src/net/rpc.gen.ts');
const check = process.argv.includes('--check');

/** Every name `src` hands to `.rpc(` as a literal that is not an `rpc_` door. */
function calledElse() {
  const names = new Set();
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) {
        for (const m of readFileSync(p, 'utf8').matchAll(/\.rpc\(\s*'([a-z0-9_]+)'/g)) if (!m[1].startsWith('rpc_')) names.add(m[1]);
      }
    }
  };
  walk(join(root, 'src'));
  return [...names].sort();
}

const extra = calledElse();
const sql = `
begin transaction read only;
select coalesce(json_agg(f order by f.name), '[]') from (
  select p.proname as name,
         p.proretset as setof,
         format_type(p.prorettype, null) as returns,
         coalesce((
           select json_agg(json_build_object(
                    'name', p.proargnames[i],
                    'type', format_type(p.proargtypes[i - 1], null),
                    'def', pg_get_function_arg_default(p.oid, i)) order by i)
           from generate_series(1, p.pronargs) i), '[]') as args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and (p.proname like 'rpc\\_%' or p.proname = any(:'extra'::text[]))
) f;
rollback;
`;
const raw = execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-v', `extra={${extra.join(',')}}`, '-f', '-'], {
  input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, PGOPTIONS: `${process.env.PGOPTIONS ?? ''} -c default_transaction_read_only=on` },
});
const fns = JSON.parse(raw.trim());

const missing = extra.filter((n) => !fns.some((f) => f.name === n));
if (missing.length) throw new Error(`src calls functions the database does not have: ${missing.join(', ')}`);
const twice = fns.filter((f, i) => fns.findIndex((g) => g.name === f.name) !== i).map((f) => f.name);
if (twice.length) throw new Error(`overloaded, which one name cannot type: ${[...new Set(twice)].join(', ')}`);

/** A Postgres type as the JSON PostgREST sends or takes for it. */
function ts(type) {
  if (type.endsWith('[]')) return `Array<${ts(type.slice(0, -2))}>`;
  switch (type) {
    case 'uuid': case 'text': case 'character varying': case 'date': case 'interval':
    case 'timestamp with time zone': case 'timestamp without time zone':
      return 'string';
    case 'integer': case 'bigint': case 'smallint': case 'double precision': case 'real': case 'numeric':
      return 'number';
    case 'boolean': return 'boolean';
    case 'json': case 'jsonb': return 'unknown';
    case 'void': return 'null';
    default: throw new Error(`no browser type for Postgres ${type}`);
  }
}

/**
 * Arguments that take null as a meaning the catalogue cannot show, the
 * function not being strict and the default not being NULL: an empty slot,
 * no title worn. Every other argument without a NULL default is typed as
 * never null, so a null handed to one by mistake fails to typecheck.
 */
const NULLABLE = {
  rpc_spell_bar: ['p_spell'],
  rpc_wear_title: ['p_title'],
};

const key = (name) => (/^[a-z_][a-z0-9_]*$/.test(name) ? name : JSON.stringify(name));
const lines = fns.map((f) => {
  const args = f.args.map((a) => {
    if (!a.name) throw new Error(`${f.name} has an argument with no name, which PostgREST cannot be handed`);
    const t = ts(a.type);
    const nullable = t !== 'unknown' && ((a.def !== null && /^NULL::/.test(a.def)) || (NULLABLE[f.name] ?? []).includes(a.name));
    return `${key(a.name)}${a.def !== null ? '?' : ''}: ${t}${nullable ? ' | null' : ''}`;
  });
  const one = ts(f.returns);
  const returns = f.setof ? `Array<${one}>` : one === 'unknown' || one === 'null' ? one : `${one} | null`;
  return `  ${f.name}: { args: ${args.length ? `{ ${args.join('; ')} }` : '{}'}; returns: ${returns} };`;
});

const out = `// Generated by scripts/rpc-types.mjs from the island's functions (\`npm run rpc-types\`). Do not edit.
// ${fns.length} functions.

/** Every door the browser may call, by name: what it takes and what it answers. */
export interface Rpc {
${lines.join('\n')}
}
`;

if (check) {
  const had = readFileSync(OUT, 'utf8');
  if (had !== out) {
    console.error('src/net/rpc.gen.ts differs from the database: run npm run rpc-types');
    process.exit(1);
  }
  console.log(`rpc-types: ${fns.length} functions, up to date`);
} else {
  writeFileSync(OUT, out);
  console.log(`rpc-types: ${fns.length} functions written to src/net/rpc.gen.ts`);
}
