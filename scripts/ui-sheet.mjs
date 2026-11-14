/**
 * Pictures of every window, and what is inside each, as built.
 *
 *   node scripts/ui-sheet.mjs <out>                 shoot every window and journal tab in three looks
 *   node scripts/ui-sheet.mjs <out> --only a,b      just these (window ids, or journal:<tab>)
 *   node scripts/ui-sheet.mjs <out> --look classic  just these looks (runecut-day, runecut-night, classic)
 *   node scripts/ui-sheet.mjs <out> --still         canvases in the windows left blank: what they draw moves, and is not style
 *   node scripts/ui-sheet.mjs --diff <a> <b> [look] count the pixels that differ, window by window (default classic)
 *   node scripts/ui-sheet.mjs --count <a>            how many scrollbar looks, font sizes, button shapes and paddings the probe found
 *   node scripts/ui-sheet.mjs --pair <a> <b> <out.png> key,key...   the same windows side by side, a beside b
 *
 * Serves the built site from the repository root as the boot check does, and
 * opens `supabase/test/ui-sheet-page.ts` under the game page's head as built:
 * the windows are as players get them, stylesheets, policy and all. Each look
 * (Runecut by day, Runecut by night, Classic) writes into <out>/<look>/ one
 * picture per window, a contact sheet of them all (`sheet.png`), and
 * `probe.json`: per window, what its scroll areas', rows', headings', buttons'
 * and padding's computed styles are, and the font sizes in use.
 *
 * The clock is held still and motion is off, so two runs over the same build
 * are the same picture to the pixel: that is what `--diff` relies on.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const LOOKS = [['runecut-day', 'runecut', 'day'], ['runecut-night', 'runecut', 'night'], ['classic', 'classic', 'day']];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };

function browserOptions() {
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  return { args };
}

const argv = process.argv.slice(2);
const browser = await chromium.launch(browserOptions());

/** A page of pictures in a grid with their names, photographed whole. */
async function sheet(items, out, cols = 4) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const cells = items.map(([name, png]) => `<figure><img src="data:image/png;base64,${png.toString('base64')}"><figcaption>${name}</figcaption></figure>`).join('');
  await page.setContent(`<!doctype html><style>body{margin:0;background:#3a3f3c;font:13px system-ui;color:#eee}
    main{display:grid;grid-template-columns:repeat(${cols},max-content);gap:10px;padding:10px;align-items:start}
    figure{margin:0}img{display:block;max-width:${cols > 2 ? 560 : 900}px}figcaption{padding:2px 0}</style><main>${cells}</main>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: out, fullPage: true });
  await page.close();
}

/** Pixels that differ between two pictures, and their box; or the sizes when they are not the same size. */
async function diff(a, b) {
  const page = await browser.newPage();
  const got = await page.evaluate(async ([pa, pb]) => {
    const load = (src) => new Promise((done) => { const i = new Image(); i.onload = () => done(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(pa), load(pb)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { size: `${ia.width}x${ia.height} against ${ib.width}x${ib.height}` };
    const px = (img) => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, img.width, img.height).data;
    };
    const da = px(ia), db = px(ib);
    let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0; i < da.length; i += 4) {
      if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2] || da[i + 3] !== db[i + 3]) {
        n++;
        const p = i / 4, x = p % ia.width, y = Math.floor(p / ia.width);
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
    return { n, box: n ? [x0, y0, x1, y1] : null };
  }, [a, b].map((f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`));
  await page.close();
  return got;
}

if (argv[0] === '--diff') {
  const [, a, b, look = 'classic'] = argv;
  let total = 0;
  for (const f of readdirSync(join(a, look)).filter((f) => f.endsWith('.png') && f !== 'sheet.png').sort()) {
    const other = join(b, look, f);
    if (!existsSync(other)) { console.log(`${f}: not in ${b}`); continue; }
    const d = await diff(join(a, look, f), other);
    if (d.size) { console.log(`${f}: size ${d.size}`); total++; } else {
      total += d.n;
      console.log(`${f.replace('.png', '').replace('__', ':')}: ${d.n} pixels differ${d.box ? ` in [${d.box.join(', ')}]` : ''}`);
    }
  }
  console.log(`${look}: ${total} differing pixels in all`);
  await browser.close();
  process.exit(0);
}

if (argv[0] === '--count') {
  // How many different treatments the windows' interiors use, all windows together, look by look.
  for (const [look] of LOOKS) {
    const file = join(argv[1], look, 'probe.json');
    if (!existsSync(file)) continue;
    const probes = JSON.parse(readFileSync(file, 'utf8'));
    const bars = new Set(), sizes = new Set(), buttons = new Set(), pads = new Set(), heads = new Set(), rows = new Set();
    let scrollers = 0;
    for (const p of probes) {
      for (const sc of p.scrolls) bars.add(`${sc.width} ${sc.color} ${sc.webkit}`);
      for (const sc of p.scrolls) pads.add(sc.pad);
      scrollers += p.scrolls.length;
      pads.add(p.pad);
      for (const z of p.sizes) sizes.add(z);
      for (const b of p.buttons) buttons.add(b);
      for (const h of p.headings) heads.add(h);
      if (p.row) rows.add(p.row);
    }
    console.log(`${look}: scrollbar treatments ${bars.size}, scroll areas ${scrollers} in ${probes.length} windows, font sizes ${sizes.size} (${[...sizes].sort((a, b) => a - b).join(' ')}), button shapes ${buttons.size}, paddings ${pads.size}, heading styles ${heads.size}, row heights ${rows.size}`);
  }
  await browser.close();
  process.exit(0);
}

if (argv[0] === '--pair') {
  const [, a, b, out, keys] = argv;
  const items = [];
  for (const key of keys.split(',')) {
    for (const [look] of LOOKS) {
      const f = `${key.replace(':', '__')}.png`;
      for (const [dir, when] of [[a, 'before'], [b, 'after']]) {
        if (existsSync(join(dir, look, f))) items.push([`${key} · ${look} · ${when}`, readFileSync(join(dir, look, f))]);
      }
    }
  }
  await sheet(items, out, 6);
  console.log(`wrote ${out}`);
  await browser.close();
  process.exit(0);
}

const OUT = resolve(argv[0] ?? 'ui-sheet');
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const looks = argv.includes('--look') ? argv[argv.indexOf('--look') + 1].split(',') : null;

const made = new Map();
const builtHead = readFileSync(join(ROOT, 'index.html'), 'utf8')
  .replace(/\s*<script type="module"[^>]*><\/script>/g, '')
  .replace(/\s*<link rel="modulepreload"[^>]*>/g, '');
const bundled = await build({
  entryPoints: [join(ROOT, 'supabase/test/ui-sheet-page.ts')], bundle: true, format: 'esm', write: false, logLevel: 'error', target: 'es2022',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
made.set('__sheet.js', bundled.outputFiles[0].text);
made.set('__sheet.html', builtHead.replace('</body>', '<script type="module" src="./__sheet.js"></script>\n</body>'));

const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^([/\\])+/, '');
  if (made.has(path)) { res.writeHead(200, { 'content-type': TYPES[extname(path)] }).end(made.get(path)); return; }
  const file = join(ROOT, path || 'index.html');
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const thrown = [];
/** The sheet page, fresh: nothing kept from another look's windows. */
async function fresh() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await page.clock.setFixedTime(new Date('2026-11-14T12:00:00Z'));
  await page.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
  page.on('pageerror', (e) => thrown.push(e.message));
  page.on('console', (m) => { if (/Content Security Policy|Trusted ?Type/i.test(m.text())) thrown.push(m.text()); });
  await page.goto(`${base}/__sheet.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.sheet?.done, null, { timeout: 60_000 });
  return page;
}

for (const [look, style, light] of LOOKS.filter(([l]) => !looks || looks.includes(l))) {
  const dir = join(OUT, look);
  mkdirSync(dir, { recursive: true });
  const page = await fresh();
  const keys = (await page.evaluate(() => window.sheet.keys)).filter((k) => !only || only.includes(k));
  if (argv.includes('--still')) await page.evaluate(() => { window.sheet.still = true; });
  await page.evaluate(([s, l]) => window.sheet.look(s, l), [style, light]);
  const probes = [];
  const shots = [];
  for (const key of keys) {
    const box = await page.evaluate((k) => window.sheet.show(k), key);
    const R = 56;
    const clip = { x: Math.max(0, box.x - R), y: Math.max(0, box.y - R), width: Math.min(1280, box.w + 2 * R), height: Math.min(900 - Math.max(0, box.y - R), box.h + 2 * R) };
    if (process.env.UI_SHEET_FULL) await page.screenshot({ path: join(dir, `${key.replace(':', '__')}-full.png`) });
    if (process.env.UI_SHEET_DEBUG) {
      console.log(key, await page.evaluate((k) => {
        const w = document.querySelectorAll('.win');
        return [...w].filter((e) => !e.hidden).map((e) => { const a = []; for (let p = e; p; p = p.parentElement) a.push(`${p.tagName}#${p.id}:${p.style.visibility}/${getComputedStyle(p).visibility}`); return a.join(" < ") + " css=" + e.style.cssText; }).join(" || ");
      }, key));
    }
    const png = await page.screenshot({ clip });
    const file = join(dir, `${key.replace(':', '__')}.png`);
    writeFileSync(file, png);
    shots.push([key, png]);
    probes.push(await page.evaluate((k) => window.sheet.probe(k), key));
  }
  writeFileSync(join(dir, 'probe.json'), `${JSON.stringify(probes, null, 1)}\n`);
  if (!only) await sheet(shots, join(dir, 'sheet.png'));
  console.log(`${look}: ${shots.length} windows`);
  await page.close();
}
if (thrown.length) console.error(`thrown or refused:\n  ${thrown.slice(0, 10).join('\n  ')}`);
await browser.close();
server.close();
