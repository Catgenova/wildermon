/**
 * Replaces the small helpers copied into each wildermon line (`src/render/wild-*.ts`) with the one in
 * `src/render/beastkit.ts`, where the copy is the same function: the same tokens, comments and spacing aside, and every
 * name it reads (`smooth`, `frac`, `lerp`, ...) imported from the same module as beastkit's. A copy that differs in any
 * token is a variant and stays where it is. A name a line imported from another line's copy is imported from beastkit.
 *
 *   node tools/codemod/beast-helpers.mjs           rewrite the files, and print what was replaced and what was left
 *   node tools/codemod/beast-helpers.mjs --dry     print only
 *
 * Run again on rewritten files it changes nothing.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const HELPERS = ['ramp', 'jitter', 'hump', 'nearSide', 'css', 'mixV'];
const KIT = 'src/render/beastkit.ts';
const DIR = 'src/render';
const dry = process.argv.includes('--dry');

const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
/**
 * A statement as the compiler prints it back from its syntax tree, without `export`: comments and spacing between
 * tokens go, and the text of every literal (a template's included) is kept as written.
 */
function tokens(st) {
  return printer.printNode(ts.EmitHint.Unspecified, st, st.getSourceFile()).replace(/^export /, '');
}

/** The top-level helper a statement declares, if it declares exactly one of them. */
function helperOf(st) {
  if (ts.isFunctionDeclaration(st) && st.name && HELPERS.includes(st.name.text)) return st.name.text;
  if (ts.isVariableStatement(st) && st.declarationList.declarations.length === 1) {
    const d = st.declarationList.declarations[0];
    if (ts.isIdentifier(d.name) && HELPERS.includes(d.name.text)) return d.name.text;
  }
  return undefined;
}
const exported = (st) => !!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** Every identifier a statement reads that it does not declare itself (its parameters and its own name aside). */
function freeNames(st) {
  const bound = new Set();
  const used = new Set();
  const walk = (n) => {
    if ((ts.isParameter(n) || ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n)) && n.name && ts.isIdentifier(n.name)) bound.add(n.name.text);
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const isProp = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || (ts.isQualifiedName(p) && p.right === n);
      if (!isProp) used.add(n.text);
    }
    ts.forEachChild(n, walk);
  };
  walk(st);
  return [...used].filter((x) => !bound.has(x) && !['Math', 'undefined'].includes(x));
}

/** name -> { module, imported, typeOnly, spec } for a file's named imports. */
function importsOf(sf) {
  const m = new Map();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause?.namedBindings || !ts.isNamedImports(st.importClause.namedBindings)) continue;
    for (const el of st.importClause.namedBindings.elements) {
      m.set(el.name.text, { module: st.moduleSpecifier.text, imported: (el.propertyName ?? el.name).text, decl: st, spec: el });
    }
  }
  return m;
}

/** Where a statement starts, with the comments right over it (no blank line between), from the start of its line. */
function startWithDoc(text, st) {
  let start = st.getStart();
  const ranges = ts.getLeadingCommentRanges(text, st.getFullStart()) ?? [];
  for (let i = ranges.length - 1; i >= 0; i--) {
    const gap = text.slice(ranges[i].end, start);
    if (/\n\s*\n/.test(gap) || !/^\s*$/.test(gap)) break;
    start = ranges[i].pos;
  }
  return text.lastIndexOf('\n', start - 1) + 1;
}
const endOfLine = (text, at) => { const n = text.indexOf('\n', at); return n < 0 ? text.length : n + 1; };

/** The order imports are listed in: by name, capitals or not, every `type` after the values. */
const byName = (a, b) => (a.startsWith('type ') - b.startsWith('type ')) || a.replace(/^type /, '').localeCompare(b.replace(/^type /, ''), 'en', { sensitivity: 'base' });
/** `x` put into a list in order, after the last name before it. */
function placed(names, x) {
  let i = 0;
  while (i < names.length && byName(names[i], x) < 0) i++;
  return [...names.slice(0, i), x, ...names.slice(i)];
}
/** An import, on one line if it fits in `WIDTH`, else its names wrapped over lines of their own. */
const WIDTH = 132;
function importLine(names, module) {
  const one = `import { ${names.join(', ')} } from ${module};`;
  if (one.length <= WIDTH) return one;
  const lines = [];
  let line = '';
  for (const n of names) {
    const next = line ? `${line} ${n},` : `  ${n},`;
    if (line && next.length > WIDTH) { lines.push(line); line = `  ${n},`; } else line = next;
  }
  lines.push(line);
  return `import {\n${lines.join('\n')}\n} from ${module};`;
}

/* ---- the canonical copies, from beastkit -------------------------------------------------------------------- */

const kitText = readFileSync(KIT, 'utf8');
const kitSf = parse(KIT, kitText);
const kitImports = importsOf(kitSf);
const canon = new Map();
for (const st of kitSf.statements) {
  const h = helperOf(st);
  if (!h || !exported(st)) continue;
  const deps = new Map(freeNames(st).filter((x) => kitImports.has(x)).map((x) => [x, kitImports.get(x)]));
  canon.set(h, { tokens: tokens(st), deps });
}
const missing = HELPERS.filter((h) => !canon.has(h));
if (missing.length) throw new Error(`${KIT} exports no ${missing.join(', ')}`);

/* ---- each line -------------------------------------------------------------------------------------------------- */

const files = readdirSync(DIR).filter((f) => /^wild-[a-z0-9]+\.ts$/.test(f)).sort().map((f) => join(DIR, f));
const variants = new Map(HELPERS.map((h) => [h, new Map()]));
const replaced = new Map(HELPERS.map((h) => [h, 0]));
/** file -> names whose copy there was replaced (and which another line may have imported from it). */
const gone = new Map();
const plans = new Map();

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const sf = parse(file, text);
  const imps = importsOf(sf);
  const cut = [];
  for (const st of sf.statements) {
    const h = helperOf(st);
    if (!h) continue;
    const tk = tokens(st);
    const c = canon.get(h);
    const sameDeps = freeNames(st).every((x) => {
      const want = c.deps.get(x);
      if (!want) return false;
      const got = imps.get(x);
      // Every name read, value or type, the very same import as beastkit's: not a line's own `smooth` of the same name.
      return !!got && got.module === want.module && got.imported === want.imported;
    });
    if (tk === c.tokens && sameDeps) {
      cut.push({ st, h });
      replaced.set(h, replaced.get(h) + 1);
    } else {
      const key = tk === c.tokens ? `${tk}  [reads names from elsewhere]` : tk;
      const v = variants.get(h);
      v.set(key, [...(v.get(key) ?? []), file]);
    }
  }
  if (cut.length) gone.set(file, new Set(cut.map((c) => c.h)));
  plans.set(file, { text, sf, imps, cut });
}

/** Rewrites one file: its copies out, its imports of them from beastkit, and any import that is no longer read out. */
function rewrite(file, { text, sf, imps, cut }) {
  const edits = [];
  const want = new Set(cut.map((c) => c.h));
  const drop = new Set();
  for (const { st } of cut) edits.push([startWithDoc(text, st), endOfLine(text, st.getEnd()), '']);
  // Names it imported from a line whose copy went: from beastkit now.
  for (const [name, imp] of imps) {
    const from = imp.module.match(/^\.\/(wild-[a-z0-9]+)$/);
    if (from && gone.get(join(DIR, `${from[1]}.ts`))?.has(name) && imp.imported === name) {
      want.add(name);
      drop.add(imp.spec);
    }
  }
  if (!want.size) return null;
  // What the copies read, and nothing else in the file still does, is no longer imported.
  const cutRanges = cut.map(({ st }) => [st.getFullStart(), st.getEnd()]);
  const readElsewhere = new Set();
  const walk = (n) => {
    if (ts.isImportDeclaration(n)) return;
    if (ts.isIdentifier(n) && !cutRanges.some(([a, b]) => n.pos >= a && n.end <= b)) readElsewhere.add(n.text);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  for (const { st } of cut) for (const x of freeNames(st)) if (!readElsewhere.has(x) && imps.has(x)) drop.add(imps.get(x).spec);
  // Each import declaration touched is written out again: the specifiers dropped out of it, beastkit's added in order.
  const kitDecl = sf.statements.find((s) => ts.isImportDeclaration(s) && s.moduleSpecifier.text === './beastkit' && !s.importClause?.isTypeOnly
    && s.importClause?.namedBindings && ts.isNamedImports(s.importClause.namedBindings));
  const decls = new Set([...drop].map((spec) => spec.parent.parent.parent));
  if (kitDecl) decls.add(kitDecl);
  for (const decl of decls) {
    const els = decl.importClause.namedBindings.elements;
    let names = els.filter((e) => !drop.has(e)).map((e) => e.getText());
    if (decl === kitDecl) for (const x of [...want].sort(byName)) if (!names.includes(x)) names = placed(names, x);
    const from = endOfLine(text, decl.getEnd()), to = text.lastIndexOf('\n', decl.getStart() - 1) + 1;
    edits.push([to, from, names.length ? `${importLine(names, decl.moduleSpecifier.getText())}\n` : '']);
  }
  if (!kitDecl) {
    const last = sf.statements.filter((s) => ts.isImportDeclaration(s)).at(-1);
    const at = last ? endOfLine(text, last.getEnd()) : 0;
    edits.push([at, at, `${importLine([...want].sort(byName), "'./beastkit'")}\n`]);
  }
  edits.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  let out = text;
  for (const [a, b, s] of edits) out = out.slice(0, a) + s + out.slice(b);
  return out;
}

let changed = 0;
for (const [file, plan] of plans) {
  const out = rewrite(file, plan);
  if (out === null || out === plan.text) continue;
  changed++;
  if (!dry) writeFileSync(file, out);
}

console.log(`${dry ? 'would change' : 'changed'} ${changed} of ${files.length} files`);
for (const h of HELPERS) {
  const v = variants.get(h);
  console.log(`${h}: ${replaced.get(h)} copies replaced, ${[...v.values()].reduce((n, fs) => n + fs.length, 0)} left in ${v.size} variant(s)`);
  for (const [tk, fs] of v) {
    const one = tk.replace(/\s+/g, ' ');
    console.log(`  ${fs.length}× ${one.length > 140 ? `${one.slice(0, 140)}…` : one}\n     ${fs.map((f) => f.replace(`${DIR}/`, '')).join(' ')}`);
  }
}
