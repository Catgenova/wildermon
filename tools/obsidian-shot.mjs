/**
 * Pictures of obsidian glass (`src/game/building.ts` OBSIDIAN_GLASS), drawn by the game's own renderer on the island
 * `tools/obsidian-page.ts` builds for them: a two-storey building walled and floored in it, by day and by night, at
 * a few zooms and turns of the view.
 *
 *   node tools/obsidian-shot.mjs --out /some/dir --dpr 2
 *   node tools/obsidian-shot.mjs --scenes house,upstairs --zooms 1.5,2.5 --turns 0,2 --hours 13,23
 *
 * Pictures are named <prefix>-<scene>-<day|night>-z<zoom>-r<turn>.png. Uses Playwright's Chromium
 * (`/opt/pw-browsers/chromium` when it is there) and esbuild from node_modules; never `playwright install`.
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
const flag = (name) => args.includes(`--${name}`);
const out = resolve(opt('out', 'tmp/obsidian'));
const prefix = opt('prefix', 'shot');
const scenes = opt('scenes', 'house,upstairs').split(',');
const zooms = opt('zooms', '1.5,2.5').split(',').map(Number);
const turns = opt('turns', '0,3').split(',').map(Number);
const hours = opt('hours', '13,23').split(',').map(Number);
const dpr = Number(opt('dpr', '2'));
const width = Number(opt('width', '900'));
const height = Number(opt('height', '640'));
mkdirSync(out, { recursive: true });

const ROOT = new URL('..', import.meta.url).pathname;
const bundled = await build({
  entryPoints: [join(ROOT, 'tools/obsidian-page.ts')], bundle: true, format: 'esm', write: false, logLevel: 'error', target: 'es2022',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const MADE = new Map([
  ['__obsidian.js', bundled.outputFiles[0].text],
  ['__obsidian.html', '<!doctype html><html><head><meta charset="utf-8"><title>obsidian</title></head><body style="margin:0;background:#000"><canvas id="game"></canvas><script type="module" src="./__obsidian.js"></script></body></html>'],
]);
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^([/\\])+/, '');
  const made = MADE.get(path);
  if (made) {
    res.writeHead(200, { 'content-type': path.endsWith('.js') ? 'text/javascript' : 'text/html' }).end(made);
    return;
  }
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' }[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;

const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(kept) ? { executablePath: kept } : {});
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page threw:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
await page.goto(`http://127.0.0.1:${port}/__obsidian.html`);
await page.waitForFunction(() => window.obsidian?.ready, null, { timeout: 60_000 });
const error = await page.evaluate(() => window.obsidian.error);
if (error) {
  console.error(error);
  process.exit(1);
}

for (const scene of scenes) {
  for (const hour of hours) {
    for (const zoom of zooms) {
      for (const turn of turns) {
        const name = `${prefix}-${scene}-${hour >= 6 && hour < 19 ? 'day' : 'night'}-z${zoom}-r${turn}`;
        await page.evaluate((s) => window.obsidian.shot(s), { scene, zoom, turn, hour });
        await page.screenshot({ path: join(out, `${name}.png`) });
        console.log(name);
      }
    }
  }
}
await browser.close();
server.close();
