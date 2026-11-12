#!/usr/bin/env node
/**
 * Moves the island tests onto `supabase/test/harness.ts`.
 *
 *   node tools/codemod/harness.mjs [--dry] [file.ts ...]
 *
 * With no files, every `supabase/test/*.ts` but the harness. Replaces, at the
 * top level of a test only:
 *
 *   - `const psql = (sql: string): string => execFileSync('psql', …).trim();`
 *     when it is the shared one: the same arguments, the same four PG*
 *     defaults, the output trimmed. Only `maxBuffer` may differ (or be absent),
 *     since the harness's is the largest any test used; property order may
 *     differ. Anything else (another database, other flags, a set role, a
 *     different trim, extra env) leaves the test's own.
 *   - `const ok: string[] = []; const bad: string[] = []; const check = …`
 *     when the check is word for word the shared one.
 *   - the summary — `for (const line of [...ok, ...bad]) console.log(line);`,
 *     `console.log(\`\n<title> — ${ok.length} of ${ok.length + bad.length}\`);`,
 *     `if (bad.length) process.exit(1);` — with `finish(\`<title>\`)`, the
 *     title kept as written. Any other summary stays, reading the harness's
 *     `ok` and `bad`.
 *
 * and drops `execFileSync` from the test's imports once nothing else uses it.
 * Prints what it changed and what it left, and why.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import ts from 'typescript';

const DIR = 'supabase/test';
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const named = args.filter((a) => a !== '--dry');
const files = named.length ? named : readdirSync(DIR).filter((f) => f.endsWith('.ts') && f !== 'harness.ts').map((f) => join(DIR, f));

const squash = (s) => s.replace(/\s+/g, ' ').trim();

const PSQL_ARGS = `['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-']`;
const ENV = `env: { ...process.env, PGHOST: process.env.PGHOST ?? '/var/run/postgresql', PGPORT: process.env.PGPORT ?? '5433', PGUSER: process.env.PGUSER ?? 'wildermon', PGDATABASE: process.env.PGDATABASE ?? 'postgres', },`;
/** The shared psql, squashed, with maxBuffer taken out; the options in either order seen. */
const SHARED_PSQL = [
  `const psql = (sql: string): string => execFileSync('psql', ${PSQL_ARGS}, { input: sql, encoding: 'utf8', ${ENV} }).trim();`,
  `const psql = (sql: string): string => execFileSync('psql', ${PSQL_ARGS}, { ${ENV} input: sql, encoding: 'utf8', }).trim();`,
];
const SHARED_CHECK = squash(`
const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(\`\${passed ? 'ok  ' : 'FAIL'} \${what}\${detail ? \` — \${detail}\` : ''}\`);
};`);
const SUMMARY = /^for \(const line of \[\.\.\.ok, \.\.\.bad\]\) console\.log\(line\);\nconsole\.log\(`\\n([^`\n]*?) — \$\{ok\.length\} of \$\{ok\.length \+ bad\.length\}`\);\nif \(bad\.length\) process\.exit\(1\);$/m;

/** The top-level statements of a file, with their text. */
const topLevel = (src) => {
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  return { sf, stmts: sf.statements.map((s) => ({ node: s, start: s.getStart(sf), end: s.end, text: src.slice(s.getStart(sf), s.end) })) };
};
const declares = (st, name) => ts.isVariableStatement(st.node)
  && st.node.declarationList.declarations.length === 1
  && ts.isIdentifier(st.node.declarationList.declarations[0].name)
  && st.node.declarationList.declarations[0].name.text === name;

/** How many identifiers named `name` are read as values (not property names) anywhere in the file. */
const uses = (sf, name) => {
  let n = 0;
  const walk = (node) => {
    if (ts.isIdentifier(node) && node.text === name) {
      const p = node.parent;
      const isKey = (ts.isPropertyAccessExpression(p) && p.name === node)
        || ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p)) && p.name === node)
        || (ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p));
      if (!isKey) n++;
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return n;
};

/** Cut [start, end) out of src along with the line it leaves empty. */
const cut = (src, start, end) => {
  let s = start;
  while (s > 0 && (src[s - 1] === ' ' || src[s - 1] === '\t')) s--;
  let e = end;
  while (e < src.length && (src[e] === ' ' || src[e] === '\t')) e++;
  if (src[e] === '\n') e++;
  // no two blank lines where the cut was
  while (src[e] === '\n' && src[s - 1] === '\n' && src[s - 2] === '\n') e++;
  return src.slice(0, s) + src.slice(e);
};

const changed = [];
const left = [];
for (const file of files) {
  let src = readFileSync(file, 'utf8');
  const name = basename(file);
  const why = [];
  const take = new Set();

  // psql
  {
    const { stmts } = topLevel(src);
    const defs = stmts.filter((st) => declares(st, 'psql'));
    if (defs.length === 1) {
      const def = defs[0];
      const shape = squash(def.text).replace(/maxBuffer: [^,]+, /, '');
      if (SHARED_PSQL.includes(shape)) {
        src = cut(src, def.start, def.end);
        take.add('psql');
      } else why.push('psql differs');
    } else if (defs.length > 1) why.push('psql defined twice');
    else why.push('no psql of its own');
  }

  // ok, bad, check
  {
    const { stmts } = topLevel(src);
    const i = stmts.findIndex((st) => declares(st, 'ok'));
    const trio = i >= 0 ? stmts.slice(i, i + 3) : [];
    const one = trio.length === 3 && declares(trio[0], 'ok') && declares(trio[1], 'bad') && declares(trio[2], 'check')
      && squash(trio.map((t) => t.text).join('\n')) === SHARED_CHECK
      // nothing but whitespace between them, so no comment is lost with them
      && /^\s*$/.test(src.slice(trio[0].end, trio[1].start)) && /^\s*$/.test(src.slice(trio[1].end, trio[2].start));
    const others = stmts.filter((st) => declares(st, 'ok') || declares(st, 'bad') || declares(st, 'check')).length;
    if (one && others === 3) {
      src = cut(src, trio[0].start, trio[2].end);
      take.add('check');
      const m = SUMMARY.exec(src);
      if (m) {
        const title = /^[^'\\$]*$/.test(m[1]) ? `'${m[1]}'` : `\`${m[1]}\``;
        src = src.slice(0, m.index) + `finish(${title});` + src.slice(m.index + m[0].length);
        take.add('finish');
      } else why.push('summary differs (kept, on the harness\'s ok and bad)');
    } else if (i >= 0 || stmts.some((st) => declares(st, 'check'))) why.push('check differs');
    else why.push('no check of its own');
  }

  if (!take.size) {
    left.push(`${name}: ${why.join('; ')}`);
    continue;
  }

  // what the file now needs from the harness
  {
    const { sf } = topLevel(src);
    for (const n of ['ok', 'bad']) if (take.has('check') && uses(sf, n) > 0) take.add(n);
    if (take.has('check') && uses(sf, 'check') === 0) take.delete('check');
  }
  const names = ['psql', 'ok', 'bad', 'check', 'finish'].filter((n) => take.has(n));

  // execFileSync no longer used: out of the import
  {
    const { sf, stmts } = topLevel(src);
    if (take.has('psql') && uses(sf, 'execFileSync') === 0) {
      const imp = stmts.find((st) => ts.isImportDeclaration(st.node) && st.node.moduleSpecifier.text === 'node:child_process');
      const clause = imp?.node.importClause;
      const spec = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : null;
      if (imp && spec && !clause.name) {
        const rest = spec.filter((e) => e.name.text !== 'execFileSync').map((e) => e.getText(sf));
        if (rest.length === spec.length) { /* imported under another name: leave */ } else if (rest.length) {
          src = src.slice(0, imp.start) + `import { ${rest.join(', ')} } from 'node:child_process';` + src.slice(imp.end);
        } else src = cut(src, imp.start, imp.end);
      }
    }
  }

  // the import, after the last import at the top
  {
    const { stmts } = topLevel(src);
    const line = `import { ${names.join(', ')} } from './harness';`;
    let last = -1;
    for (const st of stmts) { if (ts.isImportDeclaration(st.node)) last = st.end; else break; }
    if (last < 0) {
      // no imports: after the opening doc comment, if any
      const first = stmts[0];
      const at = first ? first.start : src.length;
      src = src.slice(0, at) + line + '\n' + src.slice(at);
    } else src = src.slice(0, last) + '\n' + line + src.slice(last);
  }

  if (!dry) writeFileSync(file, src);
  changed.push(`${name}: ${names.join(', ')}${why.length ? ` (${why.join('; ')})` : ''}`);
}

console.log(`converted ${changed.length}:`);
for (const c of changed) console.log(`  ${c}`);
console.log(`left alone ${left.length}:`);
for (const l of left) console.log(`  ${l}`);
