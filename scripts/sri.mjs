/**
 * Subresource Integrity on the built pages: every script and stylesheet they
 * load from assets/ carries the hash of the bytes it has to be, so a file that
 * changed on the way, or on the host, is refused rather than run.
 *
 * Run by `npm run build` after scripts/copy-site.mjs, on the pages and assets/
 * at the repository root, as GitHub Pages serves them. For each page it:
 *
 *   * puts `integrity` (sha384) and `crossorigin` on each `<script src>`,
 *     `<link rel="modulepreload">` and `<link rel="stylesheet">` from assets/;
 *   * writes an import map ahead of them naming every module in assets/: each
 *     bare `./assets/x.js` (how one chunk imports another, and how a dynamic
 *     import finds help.js) to its stamped `?v=` address, and that address to
 *     its hash under `integrity`, so the modules the entry imports are checked
 *     too, not only the entry;
 *   * adds the import map's own sha256 to the page's script-src, since it is an
 *     inline script and the policy runs none that it does not name.
 *
 * Google Fonts' stylesheet is left as it is: Google serves different CSS to
 * different browsers, so it has no one hash to pin.
 *
 * Running it twice changes nothing: what it added is taken out first.
 * `--check` changes nothing and fails if a page's hashes do not match the files
 * (scripts/boot-check.mjs runs it).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.env.SRI_ROOT ?? new URL('..', import.meta.url).pathname);
const PAGES = ['index.html', 'account.html'];
const CHECK = process.argv.includes('--check');

const hash = (alg, bytes) => `${alg}-${createHash(alg).update(bytes).digest('base64')}`;
const sri = (file) => hash('sha384', readFileSync(join(ROOT, file)));
/** The `?v=` stamp scripts/copy-site.mjs puts on a link, so both name a file the same way. */
const stamp = (file) => createHash('sha256').update(readFileSync(join(ROOT, file))).digest('hex').slice(0, 8);

const MAP_OPEN = '<script type="importmap">';
const MAP = /\s*<script type="importmap">[\s\S]*?<\/script>/;
const TAG = /<(script|link)\b[^>]*>/g;

/** The import map for every module in assets/. */
function importMap() {
  const imports = {};
  const integrity = {};
  for (const name of readdirSync(join(ROOT, 'assets')).filter((n) => n.endsWith('.js')).sort()) {
    const file = `assets/${name}`;
    const at = `./${file}?v=${stamp(file)}`;
    imports[`./${file}`] = at;
    integrity[at] = sri(file);
  }
  return { imports, integrity };
}

/** The asset a tag loads, as a file under the root, or null when it loads nothing from assets/ that wants a hash. */
function assetOf(tag) {
  const kind = tag.startsWith('<script') ? 'script' : (tag.match(/\brel="([^"]*)"/)?.[1] ?? '');
  if (!['script', 'modulepreload', 'stylesheet'].includes(kind)) return null;
  const url = tag.match(/\b(?:src|href)="(\.\/assets\/[^"?]+)(?:\?[^"]*)?"/)?.[1];
  return url ? url.slice(2) : null;
}

const problems = [];
for (const page of PAGES) {
  const path = join(ROOT, page);
  const was = readFileSync(path, 'utf8');
  const map = importMap();
  const mapText = JSON.stringify(map);
  const mapHash = `'${hash('sha256', mapText)}'`;

  if (CHECK) {
    const inPage = was.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];
    if (inPage !== mapText) problems.push(`${page}: its import map is not the one assets/ wants`);
    else if (!was.includes(`script-src 'self' ${mapHash}`)) problems.push(`${page}: script-src does not name its import map's hash ${mapHash}`);
    for (const [tag] of was.matchAll(TAG)) {
      const file = assetOf(tag);
      if (!file) continue;
      const said = tag.match(/\bintegrity="([^"]*)"/)?.[1];
      if (said !== sri(file)) problems.push(`${page}: ${file} ${said ? 'has the wrong integrity' : 'has no integrity'}`);
      if (!/\bcrossorigin\b/.test(tag)) problems.push(`${page}: ${file} has no crossorigin`);
    }
    continue;
  }

  // What an earlier run added, taken out.
  let html = was.replace(MAP, '').replace(/ integrity="[^"]*"/g, '').replace(/(script-src 'self') 'sha256-[^']*'/, '$1');
  html = html.replace(TAG, (tag) => {
    const file = assetOf(tag);
    if (!file) return tag;
    let out = tag.replace(/\s*\/?>$/, '');
    if (!/\bcrossorigin\b/.test(out)) out += ' crossorigin';
    return `${out} integrity="${sri(file)}">`;
  });
  const first = html.search(/<script type="module"|<link rel="modulepreload"/);
  if (first < 0) throw new Error(`${page}: no module script to put an import map ahead of.`);
  const indent = html.slice(html.lastIndexOf('\n', first) + 1, first);
  html = `${html.slice(0, first)}${MAP_OPEN}${mapText}</script>\n${indent}${html.slice(first)}`;
  if (!html.includes("script-src 'self'")) throw new Error(`${page}: no "script-src 'self'" in its Content-Security-Policy to add the import map to.`);
  html = html.replace("script-src 'self'", `script-src 'self' ${mapHash}`);
  writeFileSync(path, html);
}

if (CHECK) {
  for (const p of problems) console.error(`  sri: ${p}`);
  if (problems.length) process.exit(1);
  console.log(`sri: ${PAGES.join(', ')}: every script and stylesheet from assets/ carries its hash, and the import map holds every module's.`);
} else {
  console.log(`sri: integrity on every script and stylesheet from assets/ in ${PAGES.join(', ')}, and an import map with every module's.`);
}
