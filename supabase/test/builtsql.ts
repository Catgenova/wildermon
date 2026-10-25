/**
 * No SQL put together while the island runs.
 *
 * Every function in `public` is read out of `pg_proc` and every EXECUTE in it looked at. One may run:
 *
 *   * a literal, as written: `execute $q$select ...$q$`;
 *   * or `format()` of a literal whose every placeholder is `%I` or `%L` (or `%%`), so what goes in
 *     goes in quoted, and whatever comes after it (`into`, `using`).
 *
 * Anything else fails: text joined with `||`, `%s`, a variable holding SQL, a function's answer. Where
 * SQL has to be built, it is built in `private`, out of the catalog, and never in a door's reach.
 *
 * And the check itself, on functions written to be caught and to be let through, so that a check that
 * passes because it no longer reads anything is caught too.
 */
import { execFileSync } from 'node:child_process';

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
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/** A piece of a function's body: code, or a literal with what is inside it. */
interface Piece { code: string; lit: string | null }

/** A body cut into code and literals, comments dropped. Literals: '...', E'...', $tag$...$tag$. */
export function pieces(src: string): Piece[] {
  const out: Piece[] = [];
  let code = '';
  let i = 0;
  const flush = (): void => { if (code) out.push({ code, lit: null }); code = ''; };
  while (i < src.length) {
    const c = src[i];
    const rest = src.slice(i);
    if (rest.startsWith('--')) {
      const end = src.indexOf('\n', i);
      i = end < 0 ? src.length : end;
      code += ' ';
      continue;
    }
    if (rest.startsWith('/*')) {
      let depth = 0;
      while (i < src.length) {
        if (src.startsWith('/*', i)) { depth++; i += 2; } else if (src.startsWith('*/', i)) { depth--; i += 2; if (depth === 0) break; } else i++;
      }
      code += ' ';
      continue;
    }
    const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest);
    if (tag && !/[A-Za-z0-9_]/.test(src[i - 1] ?? ' ')) {
      const end = src.indexOf(tag[0], i + tag[0].length);
      const stop = end < 0 ? src.length : end;
      flush();
      out.push({ code: '', lit: src.slice(i + tag[0].length, stop) });
      i = stop + tag[0].length;
      continue;
    }
    if (c === "'" || ((c === 'E' || c === 'e') && src[i + 1] === "'" && !/[A-Za-z0-9_]/.test(src[i - 1] ?? ' '))) {
      const escapes = c !== "'";
      let j = i + (escapes ? 2 : 1);
      let lit = '';
      while (j < src.length) {
        if (escapes && src[j] === '\\') { lit += src[j + 1] ?? ''; j += 2; continue; }
        if (src[j] === "'" && src[j + 1] === "'") { lit += "'"; j += 2; continue; }
        if (src[j] === "'") break;
        lit += src[j];
        j++;
      }
      flush();
      out.push({ code: '', lit });
      i = j + 1;
      continue;
    }
    code += c;
    i++;
  }
  flush();
  return out;
}

/** Every EXECUTE in a PL/pgSQL body, as the pieces of its statement up to the `;`, and why it is wrong, or null. */
export function executes(src: string): Array<{ text: string; why: string | null }> {
  const ps = pieces(src);
  const found: Array<{ text: string; why: string | null }> = [];
  for (let k = 0; k < ps.length; k++) {
    if (ps[k].lit !== null) continue;
    const re = /\bexecute\b/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(ps[k].code))) {
      // The statement: the rest of this piece and what follows, to the `;` outside any literal.
      const stmt: Piece[] = [];
      let tail = ps[k].code.slice(m.index + m[0].length);
      let n = k;
      for (;;) {
        const semi = tail.indexOf(';');
        if (semi >= 0) { stmt.push({ code: tail.slice(0, semi), lit: null }); break; }
        stmt.push({ code: tail, lit: null });
        n++;
        if (n >= ps.length) break;
        if (ps[n].lit !== null) { stmt.push(ps[n]); tail = ''; continue; }
        tail = ps[n].code;
      }
      const text = stmt.map((p) => (p.lit !== null ? `'${p.lit}'` : p.code)).join('').replace(/\s+/g, ' ').trim();
      found.push({ text, why: verdict(stmt) });
      if (n > k) break;
    }
  }
  return found;
}

/** What is wrong with what an EXECUTE runs, or null. */
function verdict(stmt: Piece[]): string | null {
  // What it runs is everything before `into` or `using` outside a literal.
  const what: Piece[] = [];
  for (const p of stmt) {
    if (p.lit !== null) { what.push(p); continue; }
    const cut = /\b(into|using)\b/i.exec(p.code);
    if (cut) { what.push({ code: p.code.slice(0, cut.index), lit: null }); break; }
    what.push(p);
  }
  const code = what.filter((p) => p.lit === null).map((p) => p.code).join(' ').replace(/\s+/g, ' ').trim();
  const lits = what.filter((p) => p.lit !== null);
  if (code.includes('||')) return 'text joined with ||';
  if (code === '' && lits.length === 1) return null;
  const fmt = /^format\s*\(/i.test(code) && what.findIndex((p) => p.lit !== null) > 0
    && what.slice(0, what.findIndex((p) => p.lit !== null)).every((p) => p.lit === null && /^\s*format\s*\(\s*$/i.test(p.code));
  if (!fmt) return lits.length === 0 ? 'SQL from a variable or a call' : 'not a literal nor format() of one';
  const spec = lits[0].lit ?? '';
  const holes = spec.match(/%(\d+\$)?-?\d*[A-Za-z%]/g) ?? [];
  const loose = holes.filter((h) => !/[IL%]$/.test(h));
  if (loose.length) return `format() with ${loose.join(', ')}`;
  return null;
}

/* ---- the check, on functions written for it ------------------------------------------------------- */

const caught: Array<[string, string]> = [
  ['joined', `begin execute 'select * from item where def = ''' || p || ''''; end`],
  ['a %s', `begin execute format('select * from %s', p); end`],
  ['a variable', `declare q text := 'select 1'; begin execute q; end`],
  ['a call', `begin execute lower('SELECT 1'); end`],
  ['joined after format', `begin execute format('select %L', p) || ' limit 1'; end`],
  ['a positional %1$s', `begin execute format('select %1$s', p) into v; end`],
];
const passed: Array<[string, string]> = [
  ['a literal', `begin execute $q$select count(*) from cron.job where jobname = 'world-tick'$q$ into n; end`],
  ['format with %I and %L, into and using', `begin execute format('select count(*) from public.%I where x = %L and y = $1', t, v) into n using w; end`],
  ['a literal with || inside it', `begin execute 'select ''a'' || ''b'''; end`],
  ['a comment saying execute q', `begin -- execute q || x;\n perform 1; /* execute p */ end`],
  ['grant execute in a literal', `begin perform private.shut('grant execute on function f() to authenticated'); end`],
  ['a word with execute in it', `begin if p = 'berserker_execute' then return; end if; end`],
];
for (const [what, src] of caught) {
  const e = executes(src);
  check(`the check catches ${what}`, e.length === 1 && e[0].why !== null, JSON.stringify(e));
}
for (const [what, src] of passed) {
  const e = executes(src);
  check(`and lets through ${what}`, e.every((x) => x.why === null), JSON.stringify(e));
}

/* ---- every function in public --------------------------------------------------------------------- */

// And one written into public in a transaction rolled back, which the check must find.
const rows = psql(`
begin;
create function public.zz_built_sql_probe(p text) returns bigint language plpgsql as $f$
declare n bigint;
begin
  execute 'select count(*) from item where def = ' || quote_literal(p) into n;
  return n;
end $f$;
select json_agg(json_build_object('fn', p.oid::regprocedure::text, 'src', p.prosrc) order by p.oid::regprocedure::text)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
 where n.nspname = 'public' and l.lanname = 'plpgsql';
rollback;
`);
const fns = JSON.parse(rows) as Array<{ fn: string; src: string }>;
const probe = fns.find((f) => f.fn.startsWith('zz_built_sql_probe'));
check('a function in public with built SQL is found', !!probe && executes(probe.src).some((e) => e.why !== null),
  probe ? JSON.stringify(executes(probe.src)) : 'not read');
const real = fns.filter((f) => !f.fn.startsWith('zz_built_sql_probe'));
const wrong = real.flatMap((f) => executes(f.src).filter((e) => e.why !== null).map((e) => `${f.fn}: ${e.why}: ${e.text.slice(0, 120)}`));
const all = real.reduce((n, f) => n + executes(f.src).length, 0);
check(`no function in public runs SQL built at run time (${real.length} read, ${all} EXECUTE)`,
  real.length > 500 && wrong.length === 0, wrong.join('\n     ') || 'none');
check('barter_split and rpc_work_deliver run no EXECUTE at all',
  real.filter((f) => /^(barter_split|rpc_work_deliver)\(/.test(f.fn)).every((f) => executes(f.src).length === 0)
    && real.filter((f) => /^(barter_split|rpc_work_deliver)\(/.test(f.fn)).length === 2);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nno SQL built at run time — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
