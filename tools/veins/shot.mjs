/**
 * Sheets of the seams as the game draws them (`tools/veins/page.ts`), at twice
 * the pixels:
 *
 *   node tools/veins/shot.mjs --out .pngs/veins --cells <scratch dir>   # overview, sheets, the quarried hill
 *   node tools/veins/shot.mjs --only overview|sheets|face --out ...
 *   node tools/veins/shot.mjs --bench                                    # the cost, as JSON
 *
 * The overview is the whole field by day and by night at zoom 1; the sheets
 * each kind close (zoom 3) by day and night; the hill is a quarried face by
 * day and night and at a diagonal and a quarter turn of the camera.
 *
 * Uses Playwright's Chromium (`/opt/pw-browsers/chromium` when it is there)
 * and esbuild from node_modules; never `playwright install`.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const out = resolve(opt('out', '.pngs/veins'));
const cells = resolve(opt('cells', 'tmp/veins-cells'));
const only = opt('only', '');
mkdirSync(out, { recursive: true });
mkdirSync(cells, { recursive: true });

const ROOT = new URL('../..', import.meta.url).pathname;
const bundled = await build({
  entryPoints: [join(ROOT, 'tools/veins/page.ts')], bundle: true, format: 'esm', write: false, logLevel: 'error', target: 'es2022',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
let sheetHtml = '';
const MADE = new Map([
  ['__veins.js', bundled.outputFiles[0].text],
  ['__veins.html', '<!doctype html><html><head><meta charset="utf-8"><title>veins</title></head><body style="margin:0;background:#000"><canvas id="game"></canvas><script type="module" src="./__veins.js"></script></body></html>'],
]);
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^([/\\])+/, '');
  if (path === '__sheet.html') { res.writeHead(200, { 'content-type': 'text/html' }).end(sheetHtml); return; }
  const made = MADE.get(path);
  if (made) {
    res.writeHead(200, { 'content-type': path.endsWith('.js') ? 'text/javascript' : 'text/html' }).end(made);
    return;
  }
  const base = path.startsWith('__cells/') ? cells : ROOT;
  const file = join(base, path.replace(/^__cells\//, ''));
  if (!file.startsWith(base) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' }[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(kept) ? { executablePath: kept } : {});

/** A page, tried again a few times: the machine is shared and a renderer can be killed for memory. */
async function open(query, width, height) {
  for (let i = 0; ; i++) {
    try {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
      const page = await context.newPage();
      page.on('pageerror', (e) => console.error('page threw:', e.message));
      page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
      await page.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
      await page.goto(`http://127.0.0.1:${port}/__veins.html?${query}`);
      await page.waitForFunction(() => window.veins?.ready, null, { timeout: 90_000 });
      const error = await page.evaluate(() => window.veins.error);
      if (error) { console.error(error); process.exit(1); }
      return { page, context };
    } catch (err) {
      if (i >= 6) throw err;
      console.error(`open again: ${err.message.split('\n')[0]}`);
      await new Promise((d) => setTimeout(d, 5000));
    }
  }
}
const done = async () => { await browser.close(); server.close(); process.exit(0); };

if (args.includes('--bench')) {
  const [bw, bh] = opt('size', '1200x750').split('x').map(Number);
  const { page, context } = await open('bench=1', bw, bh);
  console.log(JSON.stringify(await page.evaluate((n) => window.veins.bench(n), args.includes('--night')), null, 1));
  await context.close();
  await done();
}

const HOURS = [[13, 'day'], [23, 'night']];

if (!only || only === 'overview') {
  const { page, context } = await open('scene=field', 1600, 1000);
  for (const [hour, when] of HOURS) {
    await page.evaluate((s) => window.veins.shot(s), { x: 12.5, y: 11, zoom: 1, hour, t: 20, labels: true });
    const p = join(out, `overview-after-${when}-z1.png`);
    await page.screenshot({ path: p });
    console.log(p);
  }
  await context.close();
}

if (!only || only === 'face') {
  const { page, context } = await open('scene=face', 1600, 1000);
  for (const [turn, hour, when, zoom] of [[0, 13, 'day', 1.5], [0, 23, 'night', 1.5], [1, 13, 'day', 1.5], [3, 22, 'night', 1.5], [2, 13, 'day', 2]]) {
    await page.evaluate((s) => window.veins.shot(s), { x: 20, y: 18, zoom, hour, t: 20, turn });
    const p = join(out, `face-turn${turn}-${when}-z${zoom}.png`);
    await page.screenshot({ path: p });
    console.log(p);
  }
  await context.close();
}

if (!only || only === 'sheets') {
  let s = await open('scene=field', 520, 340);
  const entries = await s.page.evaluate(() => window.veins.entries.map((e, i) => ({ ...e, at: window.veins.at(i) })));
  let n = 0;
  for (const e of entries) {
    for (const [hour, when] of HOURS) {
      for (const turn of [0, 1]) {
        const p = join(cells, `${e.key}-${when}-t${turn}-z3.png`);
        if (existsSync(p) && !args.includes('--fresh')) continue;
        if (++n % 16 === 0) { await s.context.close(); s = await open('scene=field', 520, 340); }
        await s.page.evaluate((v) => window.veins.shot(v), { x: e.at[0] + 1, y: e.at[1] + 1.15, zoom: 3, hour, t: 20, turn });
        await s.page.screenshot({ path: p });
      }
    }
  }
  await s.context.close();
  const GROUPS = [
    ['base-metals', 'Base metals, with the band of the ore round the lip', ['copper', 'iron', 'tin', 'zinc', 'lead']],
    ['precious-rare', 'Precious and rare ores', ['silver', 'gold', 'adamantine', 'glimmersteel', 'mithril', 'seryll']],
    ['stone-coal', 'Stone seams, coal, unidentified metal', ['slate', 'marble', 'sandstone', 'coal', 'unknown']],
    ['prospected', 'Prospected, bare and buried', ['p-gold', 'p-iron', 'p-adamantine', 'p-unknown', 'p-copper-buried', 'p-mithril-buried', 'p-unknown-buried']],
  ];
  const COLS = [['day', 0, 'Day'], ['night', 0, 'Night'], ['day', 1, 'Day, turned 45°'], ['night', 1, 'Night, turned 45°']];
  const style = `<style>body{margin:0;background:#2a2433;color:#f3ead8;font:600 13px system-ui,sans-serif}h1{font-size:18px;margin:10px 12px 6px}
table{border-collapse:separate;border-spacing:6px}td,th{padding:0;vertical-align:middle}th{text-align:left;font-weight:600;padding:0 4px;color:#d9cdb8}
td.k{padding-right:6px;white-space:nowrap;text-align:right;color:#f3ead8}img{display:block;border-radius:4px}</style>`;
  const label = (k) => entries.find((e) => e.key === k)?.label ?? k;
  for (const [name, title, keys] of GROUPS) {
    sheetHtml = `<!doctype html><html><head><meta charset="utf-8">${style}</head><body><h1>${title} · zoom 3</h1><table><tr><th></th>${COLS.map((c) => `<th>${c[2]}</th>`).join('')}</tr>${keys.map((k) => `<tr><td class="k">${label(k)}</td>${COLS.map(([when, turn]) => `<td><img width="520" height="340" src="/__cells/${k}-${when}-t${turn}-z3.png"></td>`).join('')}</tr>`).join('')}</table></body></html>`;
    const context = await browser.newContext({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/__sheet.html`);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    const p = join(out, `sheet-${name}-z3.png`);
    await page.screenshot({ path: p, fullPage: true });
    console.log(p);
    await context.close();
  }
}
await done();
