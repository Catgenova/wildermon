/**
 * The production bundle's three last passes, as one Vite plugin (`harden()`):
 *
 *   1. Property names renamed. A name is renamed only when every place it is
 *      written in src/ is `this.<name>` or the `private` member that declares
 *      it, it is not a word in any string, template or regular expression in
 *      src/, not a property of the DOM or the language (TypeScript's lib
 *      files), and not a word in any module bundled from outside src/ (the
 *      Supabase client, Vite's helpers), nor in the tests, tools and build
 *      scripts, which may read a member by name. So nothing that crosses the
 *      wire, is kept in the browser's storage or is read by name — RPC
 *      arguments, JSON fields, storage keys, the protocol in src/net — is ever
 *      touched: each of those is written somewhere other than after `this.`. Every renamed
 *      name becomes `$$<base 36>`, the same in every module. Done as each
 *      module is read, before Rolldown bundles and minifies it.
 *   2. The island's wire code (`NET_MODULES`: the RPC and realtime layer and
 *      the wire format in src/net) through javascript-obfuscator, each module
 *      after its renames and before it is bundled: string array, base64,
 *      control-flow flattening at `NET_OBFUSCATION`. Seeded from the module,
 *      so a build is the same build on every machine. Not a chunk of its own:
 *      a `net` chunk imports back from the entry chunk, and the entry is
 *      loaded as `main.js?v=<stamp>` (scripts/copy-site.mjs), so the import
 *      ran a second copy of the entry, which threw before the island was
 *      asked anything.
 *   3. The build's hash: SHA-256 of every script and stylesheet the site
 *      serves, as built, its first 16 hex digits. Written into the bundle in
 *      place of `BUILD_PLACEHOLDER` (`src/version.ts` reads it as `BUILD`) and
 *      into assets/version.json as `build`, which the deploy hands to the
 *      island (`supabase/build.sql`). The browser says it at the join, and the
 *      island refuses a build it does not know (`rpc_build_check`).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { transform } from 'esbuild';
import ts from 'typescript';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

/**
 * What `__BUILD__` is defined as in a build (never in `vite` dev, where it is
 * undefined), replaced with the build's hash once the bundle is final. Sixteen
 * hex digits, so the minifier's folding of `src/version.ts`'s test keeps it.
 */
export const BUILD_PLACEHOLDER = 'b0170b0170b0170b';

/** The modules obfuscated: the island's RPC and realtime layer and the wire format. */
export const NET_MODULES = /[\\/]src[\\/]net[\\/](island|play|transport|protocol|session|presence|told)\.ts$/;

/** javascript-obfuscator's settings for those modules, less the seed. */
export const NET_OBFUSCATION = {
  compact: true,
  target: 'browser',
  identifierNamesGenerator: 'hexadecimal',
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayIndexShift: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersType: 'variable',
  stringArrayCallsTransform: false,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.25,
  deadCodeInjection: false,
  splitStrings: false,
  numbersToExpressions: false,
  transformObjectKeys: false,
  renameGlobals: false,
  renameProperties: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  unicodeEscapeSequence: false,
  simplify: true,
  sourceMap: false,
};

const tsFiles = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) return tsFiles(p);
  return /\.ts$/.test(f) && !/\.d\.ts$/.test(f) ? [p] : [];
});

const WORD = /[A-Za-z_$][\w$]*/g;
const wordsOf = (text, into) => {
  for (const m of text.matchAll(WORD)) into.add(m[0]);
  return into;
};

const isPrivate = (decl) => !!ts.getModifiers?.(decl)?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword);

/**
 * Every `private` member name in src/ that is written nowhere but after `this.`
 * and in its own declaration, with how often it is used: the names it is safe
 * to rename, before the DOM and the bundled packages are taken out.
 */
export function privateOnly(files = tsFiles(SRC)) {
  const declared = new Set();
  const uses = new Map();
  const elsewhere = new Set();
  const visit = (node) => {
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      const name = node.text;
      const p = node.parent;
      if (p && ts.isPropertyAccessExpression(p) && p.name === node && p.expression.kind === ts.SyntaxKind.ThisKeyword) {
        uses.set(name, (uses.get(name) ?? 0) + 1);
      } else if (p && p.name === node && (ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isGetAccessorDeclaration(p)
        || ts.isSetAccessorDeclaration(p) || ts.isParameter(p)) && isPrivate(p)) {
        declared.add(name);
      } else {
        elsewhere.add(name);
      }
    } else if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralLikeNode?.(node) || ts.isRegularExpressionLiteral(node)
      || node.kind === ts.SyntaxKind.TemplateHead || node.kind === ts.SyntaxKind.TemplateMiddle || node.kind === ts.SyntaxKind.TemplateTail) {
      wordsOf(node.text ?? node.getText(), elsewhere);
    }
    ts.forEachChild(node, visit);
  };
  for (const file of files) {
    visit(ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true));
  }
  return new Map([...declared].filter((n) => !elsewhere.has(n)).map((n) => [n, uses.get(n) ?? 0]));
}

/** Every word in TypeScript's lib files: the properties of the DOM and of the language. */
export function libWords() {
  const lib = dirname(createRequire(import.meta.url).resolve('typescript/lib/lib.d.ts'));
  const words = new Set();
  for (const f of readdirSync(lib)) if (/^lib\..*\.d\.ts$/.test(f)) wordsOf(readFileSync(join(lib, f), 'utf8'), words);
  return words;
}

/**
 * Every word in the tests, the tools and the build scripts. A test that reads a
 * renderer's private member by name (`supabase/test/storeyview-page.ts` spies
 * on `drawWall`) keeps reading it, and the renamed build can be held to the
 * same page tests as the source.
 */
export function testWords() {
  const words = new Set();
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|mjs|js)$/.test(f)) wordsOf(readFileSync(p, 'utf8'), words);
    }
  };
  for (const dir of ['supabase/test', 'tools', 'scripts']) walk(join(ROOT, dir));
  return words;
}

/**
 * The renames: name to `$$<base 36>`, the most used first so they get the
 * shortest. Names of three letters or fewer are left, as renaming them saves
 * nothing. `outside` is every word in the bundled modules from outside src/.
 */
export function renames(outside = new Set()) {
  const dom = libWords();
  const tests = testWords();
  const keep = [...privateOnly()].filter(([n]) => n.length > 3 && !n.startsWith('$$') && !dom.has(n) && !outside.has(n) && !tests.has(n));
  keep.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return Object.fromEntries(keep.map(([n], i) => [n, `$$${i.toString(36)}`]));
}

/** The regular expression of every name in the table, for esbuild's `mangleProps`. */
const namesOf = (table) => new RegExp(`^(?:${Object.keys(table).map((n) => n.replace(/\$/g, '\\$')).join('|')})$`);

/**
 * The renaming itself, on one module's JavaScript before it is bundled and
 * minified, with every rename fixed in advance so every module agrees.
 */
export async function mangle(code, table, pattern = namesOf(table)) {
  if (!Object.keys(table).length) return code;
  const out = await transform(code, {
    loader: 'js',
    target: 'esnext',
    charset: 'utf8',
    legalComments: 'inline',
    mangleProps: pattern,
    mangleCache: { ...table },
    logLevel: 'error',
  });
  return out.code;
}

/** Every word in the packages the page bundles from node_modules (the Supabase client and what it brings). */
export function packageWords() {
  const words = new Set();
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(m?js|cjs)$/.test(f)) wordsOf(readFileSync(p, 'utf8'), words);
    }
  };
  walk(join(ROOT, 'node_modules', '@supabase'));
  return words;
}

/** One module through javascript-obfuscator, seeded from its own code. */
export async function obfuscate(code) {
  const { default: Obfuscator } = await import('javascript-obfuscator');
  const seed = parseInt(createHash('sha256').update(code).digest('hex').slice(0, 8), 16) || 1;
  return Obfuscator.obfuscate(code, { ...NET_OBFUSCATION, seed }).getObfuscatedCode();
}

/** The build's hash over every script and stylesheet, in name order, with the placeholder still in. */
export function buildHash(files) {
  const h = createHash('sha256');
  for (const [name, text] of [...files].sort((a, b) => (a[0] < b[0] ? -1 : 1))) h.update(`${name}\0${text}\0`);
  return h.digest('hex').slice(0, 16);
}

/** Vite: the renames and the obfuscation as each module of src/ is read, and the hash once the bundle is whole. */
export function harden({ log = console.log, rename = true, obfuscation = true } = {}) {
  let table = {};
  let pattern = /^$/;
  let named = 0;
  const net = { modules: 0, before: 0, after: 0, ms: 0 };
  return {
    name: 'wurm-harden',
    apply: 'build',
    enforce: 'post',
    config: () => ({ define: { __BUILD__: JSON.stringify(BUILD_PLACEHOLDER) } }),
    buildStart() {
      const t0 = performance.now();
      table = rename ? renames(packageWords()) : {};
      pattern = namesOf(table);
      named = performance.now() - t0;
    },
    async transform(code, id) {
      const file = id.replace(/\?.*$/, '');
      if (!file.startsWith(SRC + sep) || !/\.ts$/.test(file)) return null;
      let out = rename ? await mangle(code, table, pattern) : code;
      if (obfuscation && NET_MODULES.test(file)) {
        const t0 = performance.now();
        net.before += out.length;
        out = await obfuscate(out);
        net.after += out.length;
        net.modules++;
        net.ms += performance.now() - t0;
      }
      return out === code ? null : { code: out, map: null };
    },
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        const chunks = Object.values(bundle).filter((f) => f.type === 'chunk').sort((a, b) => (a.fileName < b.fileName ? -1 : 1));
        const names = Object.keys(table);

        /*
         * Nothing bundled from outside src/ may use a renamed name: it would be
         * renamed in src/ and not there. `packageWords` should have kept every
         * one out; this is the check that it did, on what was really bundled.
         */
        const clash = new Set();
        for (const id of this.getModuleIds()) {
          if (id.replace(/\?.*$/, '').startsWith(SRC + sep)) continue;
          const code = this.getModuleInfo(id)?.code;
          if (!code) continue;
          for (const w of wordsOf(code, new Set())) if (Object.hasOwn(table, w)) clash.add(w);
        }
        if (clash.size) this.error(`Renamed in src/ but used by a bundled package: ${[...clash].join(', ')}.`);
        // And none of the old names is left as a property anywhere.
        if (names.length) {
          const left = new Set();
          const dotted = new RegExp(`\\.(${names.map((n) => n.replace(/\$/g, '\\$')).join('|')})\\b`, 'g');
          for (const c of chunks) for (const m of c.code.matchAll(dotted)) left.add(m[1]);
          if (left.size) this.error(`Renamed names still in the bundle: ${[...left].slice(0, 20).join(', ')}.`);
        }

        const served = [
          ...chunks.map((c) => [c.fileName, c.code]),
          ...Object.values(bundle).filter((f) => f.type === 'asset' && /\.css$/.test(f.fileName)).map((f) => [f.fileName, String(f.source)]),
        ];
        const hash = buildHash(served);
        let stamped = 0;
        for (const c of chunks) {
          if (!c.code.includes(BUILD_PLACEHOLDER)) continue;
          c.code = c.code.split(BUILD_PLACEHOLDER).join(hash);
          stamped++;
        }
        if (!stamped) this.error('The build hash placeholder is in no chunk: src/version.ts must read __BUILD__.');

        const version = bundle['assets/version.json'];
        if (version && version.type === 'asset') {
          const was = JSON.parse(String(version.source));
          version.source = `${JSON.stringify({ ...was, build: hash })}\n`;
        } else {
          this.emitFile({ type: 'asset', fileName: 'assets/version.json', source: `${JSON.stringify({ build: hash })}\n` });
        }

        const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
        log(`harden: ${names.length} property names renamed (found in ${(named / 1000).toFixed(1)} s); `
          + `${net.modules} net modules obfuscated, ${kb(net.before)} -> ${kb(net.after)} before minifying, in ${(net.ms / 1000).toFixed(1)} s; build ${hash}`);
      },
    },
  };
}
