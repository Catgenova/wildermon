/**
 * The outcroppings where they stand (`tools/outcrop-page.ts`): set down on the grass of a Runestone's safe ring and
 * drawn by the game's own renderer.
 *
 *   node tools/outcrop-shot.mjs --out /some/dir                       # outcrop-day-z1.png, -z2, outcrop-night-z1.png, -z2: whole
 *   node tools/outcrop-shot.mjs --out /some/dir --uses 14,8,2,1 --name worn   # worn-day-z1.png ...: mined down
 *
 * Pictures at a device pixel ratio of 2 unless `--dpr` says otherwise. Uses Playwright's Chromium
 * (`/opt/pw-browsers/chromium` when it is there) and esbuild from node_modules; never `playwright install`.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const out = resolve(opt('out', 'tmp/outcrop'));
const dpr = Number(opt('dpr', '2'));
const uses = opt('uses', '20').split(',').map(Number);
const name = opt('name', 'outcrop');
mkdirSync(out, { recursive: true });

const ROOT = new URL('..', import.meta.url).pathname;
const bundled = await build({
  entryPoints: [join(ROOT, 'tools/outcrop-page.ts')], bundle: true, format: 'esm', write: false, logLevel: 'error', target: 'es2022',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const MADE = new Map([
  ['__outc.js', bundled.outputFiles[0].text],
  ['__outc.html', '<!doctype html><html><head><meta charset="utf-8"><title>outcrop</title></head><body style="margin:0;background:#20232a"><script type="module" src="./__outc.js"></script></body></html>'],
]);
const server = createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname.replace(/^\/+/, '');
  const made = MADE.get(path);
  if (made) res.writeHead(200, { 'content-type': path.endsWith('.js') ? 'text/javascript' : 'text/html' }).end(made);
  else res.writeHead(404).end();
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;

const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(kept) ? { executablePath: kept } : {});
const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: dpr });
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page threw:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
await page.goto(`http://127.0.0.1:${port}/__outc.html`);
await page.waitForFunction(() => window.outc?.ready, null, { timeout: 300_000 });
const error = await page.evaluate(() => window.outc.error);
if (error) {
  console.error(error);
  process.exit(1);
}
for (const [when, hour] of [['day', 13], ['night', 23]]) {
  for (const zoom of [1, 2]) {
    await page.evaluate(([z, h, u]) => window.outc.scene(z, h, u), [zoom, hour, uses]);
    const file = join(out, `${name}-${when}-z${zoom}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
}
await browser.close();
server.close();
