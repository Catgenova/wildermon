import { defineConfig, type Plugin } from 'vite';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { harden } from './scripts/harden.mjs';

/**
 * Which deploy of the site this build is, for the corner of the screen (see
 * src/version.ts). Every push to main redeploys the site, so it is the number
 * of commits on main, counting the one this build goes out in: built here,
 * that is the commit about to be made, one after HEAD; built by the "Build
 * site" workflow, it is the commit that was pushed, HEAD itself -- so the two
 * builds agree, and the workflow finds nothing to rebuild. Without the whole
 * history to count, in a shallow clone, there is no number.
 */
function deploy(): number | undefined {
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: import.meta.dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    if (git('rev-parse', '--is-shallow-repository') === 'true') return undefined;
    return Number(git('rev-list', '--count', 'HEAD')) + (process.env.GITHUB_ACTIONS === 'true' ? 0 : 1);
  } catch {
    return undefined;
  }
}

/**
 * A hash of the solid trees' code and everything it imports, for the bakes a
 * browser keeps between visits (src/render/trees3d/store.ts): a change to how
 * a tree is drawn throws away what was kept, and any other change keeps it.
 */
function trees3d(): string {
  const seen = new Set<string>();
  const hash = createHash('sha1');
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    hash.update(file.slice(import.meta.dirname.length)).update(text);
    for (const m of text.matchAll(/from '(\.[^']+)'/g)) {
      const base = resolve(dirname(file), m[1]);
      const next = [`${base}.ts`, resolve(base, 'index.ts'), base].find((f) => existsSync(f) && f.endsWith('.ts'));
      if (next) walk(next);
    }
  };
  walk(resolve(import.meta.dirname, 'src/render/trees3d/index.ts'));
  return hash.digest('hex').slice(0, 16);
}

/**
 * The app source lives in src/ (including the HTML entries). `npm run build`
 * writes dist/ and then scripts/copy-site.mjs copies the pages and assets/ to
 * the repository root, which is what GitHub Pages serves from `main`.
 * Asset names are fixed (no hashes) so rebuilds only change the files whose
 * content changed.
 *
 * Two pages, not one: `index.html` is the game and `account.html` is where a
 * username and a password are set up. They share the Supabase client and the
 * account rules and nothing else up front -- the game does not drag in a
 * sign-up form, and the landing page asks for the renderer (src/landing/backdrop.ts,
 * its cove behind the form) only once the form is up, as a chunk of its own.
 */
const deployed = deploy();

/**
 * The sculpted models (src/sculpt/assets, 191 of them, 25 MB) as files of their own rather than as code in the sculpted
 * bodies' chunk: that chunk was 24.5 MB, 7.2 MB gzipped, and changed with any change to a model or to the code beside
 * them -- 57 times in a week -- each time fetched whole again by every browser. Each model is now
 * `assets/sculpt/<name>.json`, asked for at `?v=` its own hash and checked against it (`integrity`), so a browser fetches
 * again only the models that changed. A build only: the dev server and the tests import the JSON as ever. Fetched as the
 * chunk is first evaluated (its top-level `await`), so nothing in it sees a model before it is in.
 */
function sculptAssets(): Plugin {
  const IMPORT = /^import (\w+) from '\.\/assets\/([\w-]+)\.json';\n/gm;
  return {
    name: 'sculpt-assets',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]src[\\/]sculpt[\\/][\w-]+\.ts$/.test(id) || !code.includes("from './assets/")) return null;
      const found: Array<[string, string]> = [];
      let first = -1;
      const rest = code.replace(IMPORT, (line, name: string, file: string, at: number) => {
        if (first < 0) first = at;
        found.push([name, file]);
        return '';
      });
      if (!found.length) return null;
      const asks = found.map(([, file]) => {
        const text = JSON.stringify(JSON.parse(readFileSync(resolve(dirname(id), 'assets', `${file}.json`), 'utf8')));
        this.emitFile({ type: 'asset', fileName: `assets/sculpt/${file}.json`, source: text });
        const v = createHash('sha256').update(text).digest('hex').slice(0, 8);
        const sri = `sha384-${createHash('sha384').update(text).digest('base64')}`;
        return `__sculptAsset(${JSON.stringify(file)}, ${JSON.stringify(v)}, ${JSON.stringify(sri)})`;
      });
      // The chunk's own address through a name of its own: \`new URL(..., import.meta.url)\` is Vite's to rewrite as an asset.
      const load = `const __sculptBase = import.meta.url;
const __sculptAsset = (f, v, i) => fetch(new URL('./sculpt/' + f + '.json?v=' + v, __sculptBase), { integrity: i })
  .then((r) => { if (!r.ok) throw new Error(\`model \${f}: \${r.status}\`); return r.json(); });
const [${found.map(([name]) => name).join(', ')}] = await Promise.all([${asks.join(', ')}]);
`;
      return { code: rest.slice(0, first) + load + rest.slice(first), map: null };
    },
  };
}

export default defineConfig({
  root: 'src',
  base: './',
  define: { __DEPLOY__: String(deployed ?? 'undefined'), __TREES3D__: JSON.stringify(trees3d()) },
  /*
   * assets/version.json: which deploy is on the site now, for a page left open
   * on an older one to notice (src/ui/update.ts). In assets/ so the "Build site"
   * workflow commits it with the rest.
   */
  plugins: [{
    name: 'deploy-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'assets/version.json', source: `${JSON.stringify({ deploy: deployed ?? null })}\n` });
    },
  },
  // The sculpted models, each a file of its own (`sculptAssets`).
  sculptAssets(),
  // Property names renamed, the wire code in src/net obfuscated, and the build's hash (scripts/harden.mjs).
  harden()],
  server: { port: 5173, host: true },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'src/index.html'),
        account: resolve(import.meta.dirname, 'src/account.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
        /*
         * `vite build` only (the dev server does not minify): no `console.*`
         * call and no `debugger` in what players get. Nothing reports through
         * the console -- errors reach the island by src/net/errors.ts.
         */
        minify: { compress: { dropConsole: true, dropDebugger: true }, mangle: true },
      },
    },
  },
});
