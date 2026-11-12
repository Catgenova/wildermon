// Fails on any import cycle between the game's modules that is still there at
// run time. A cycle makes the order the modules start in depend on which one is
// reached first, so a constant read at the top of a module can be undefined in
// one entry and fine in another; and it ties layers together that should not
// be (the rules to the sound, the sound to the drawing).
//
// Only imports that survive into the bundle count: `import type`, imports
// whose every name is `type`, and `export type ... from` are left out, and so
// is `import()`, which loads after every module it could meet has started.
// The graph is walked from the pages' entries (src/main.ts, src/account.ts),
// and every strongly connected set of modules is printed.
import ts from 'typescript';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const entries = ['src/main.ts', 'src/account.ts'].map((f) => resolve(root, f));

function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  for (const f of [base, `${base}.ts`, resolve(base, 'index.ts')]) {
    if (f.endsWith('.ts') && existsSync(f)) return f;
  }
  return null;
}

/** The modules `file` loads before it runs. */
function importsOf(file) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false);
  const out = [];
  for (const st of src.statements) {
    if (ts.isImportDeclaration(st)) {
      const c = st.importClause;
      if (c) {
        if (c.isTypeOnly) continue;
        const named = c.namedBindings;
        const onlyTypes =
          !c.name && named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((e) => e.isTypeOnly);
        if (onlyTypes) continue;
      }
      out.push(st.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(st) && st.moduleSpecifier) {
      if (st.isTypeOnly) continue;
      const named = st.exportClause;
      if (named && ts.isNamedExports(named) && named.elements.length > 0 && named.elements.every((e) => e.isTypeOnly)) continue;
      out.push(st.moduleSpecifier.text);
    }
  }
  return out.map((s) => resolveImport(file, s)).filter((f) => f !== null);
}

const graph = new Map();
const todo = [...entries];
while (todo.length) {
  const f = todo.pop();
  if (graph.has(f)) continue;
  const next = importsOf(f);
  graph.set(f, next);
  todo.push(...next);
}

// Tarjan's strongly connected components, without recursion.
const index = new Map();
const low = new Map();
const onStack = new Set();
const stack = [];
const sccs = [];
let counter = 0;
for (const start of graph.keys()) {
  if (index.has(start)) continue;
  const work = [[start, 0]];
  index.set(start, counter);
  low.set(start, counter++);
  stack.push(start);
  onStack.add(start);
  while (work.length) {
    const top = work[work.length - 1];
    const [v, i] = top;
    const edges = graph.get(v);
    if (i < edges.length) {
      top[1]++;
      const w = edges[i];
      if (!index.has(w)) {
        index.set(w, counter);
        low.set(w, counter++);
        stack.push(w);
        onStack.add(w);
        work.push([w, 0]);
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), index.get(w)));
      }
      continue;
    }
    work.pop();
    if (work.length) {
      const u = work[work.length - 1][0];
      low.set(u, Math.min(low.get(u), low.get(v)));
    }
    if (low.get(v) === index.get(v)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      if (scc.length > 1 || graph.get(v).includes(v)) sccs.push(scc);
    }
  }
}

/** One shortest loop through the set, from its first module back to it. */
function loopIn(scc) {
  const inSet = new Set(scc);
  const start = [...scc].sort()[0];
  const prev = new Map([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const v = queue.shift();
    for (const w of graph.get(v)) {
      if (!inSet.has(w)) continue;
      if (w === start) {
        const path = [];
        for (let x = v; x !== null; x = prev.get(x)) path.unshift(x);
        return [...path, start];
      }
      if (!prev.has(w)) {
        prev.set(w, v);
        queue.push(w);
      }
    }
  }
  return [start];
}

const name = (f) => relative(root, f);
if (sccs.length) {
  console.error(`Import cycles: ${sccs.length} set(s) of modules that import each other at run time.`);
  for (const scc of sccs) {
    console.error(`\n${scc.length} modules: ${scc.map(name).sort().join(', ')}`);
    console.error(`  e.g. ${loopIn(scc).map(name).join(' -> ')}`);
  }
  console.error('\nMove what both sides need into a module that imports neither, or make the import `import type`.');
  process.exit(1);
}
console.log(`No import cycles in ${graph.size} modules.`);
