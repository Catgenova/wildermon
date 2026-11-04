/**
 * Pictures of the waterfalls, drawn by the game's own renderer on the island
 * `tools/falls-page.ts` builds for them: each scene by day and by night, at
 * several zooms and turns of the view, and a second frame a fraction of a
 * second after the first to see the water move. Also times the frames, and
 * the falls painter alone.
 *
 *   node tools/falls-shot.mjs --out /some/dir --prefix after          # every scene, day and night, zooms 0.5 1 2, turns 0 and 3
 *   node tools/falls-shot.mjs --scenes stream,spill --zooms 1 --turns 0,2,5 --hours 13
 *   node tools/falls-shot.mjs --dpr 2                                 # pictures at twice the pixels
 *   node tools/falls-shot.mjs --bench                                 # frame times and the painter's, no pictures
 *   node tools/falls-shot.mjs --fzooms 2,3                            # the fountain's zooms (default 1,2,5)
 *   node tools/falls-shot.mjs --pair                                  # a second frame 0.12 s after each
 *
 * Pictures are named <prefix>-<scene>-<day|night>-z<zoom>-r<turn>.png. Uses
 * Playwright's Chromium (`/opt/pw-browsers/chromium` when it is there) and
 * esbuild from node_modules; never `playwright install`.
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
const out = resolve(opt('out', 'tmp/falls'));
const prefix = opt('prefix', 'shot');
const scenes = opt('scenes', 'stream,spill,fountain,aqueduct').split(',');
const zooms = opt('zooms', '0.5,1,2').split(',').map(Number);
// The fountain is a tile across: looked at closer.
const fzooms = opt('fzooms', '1,2,5').split(',').map(Number);
const turns = opt('turns', '0,3').split(',').map(Number);
const hours = opt('hours', '13,23').split(',').map(Number);
const dpr = Number(opt('dpr', '1'));
const width = Number(opt('width', '900'));
const height = Number(opt('height', '640'));
const t = Number(opt('t', '20'));
mkdirSync(out, { recursive: true });

const ROOT = new URL('..', import.meta.url).pathname;
const bundled = await build({
  entryPoints: [join(ROOT, 'tools/falls-page.ts')], bundle: true, format: 'esm', write: false, logLevel: 'error', target: 'es2022',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const MADE = new Map([
  ['__falls.js', bundled.outputFiles[0].text],
  ['__falls.html', '<!doctype html><html><head><meta charset="utf-8"><title>falls</title></head><body style="margin:0;background:#000"><canvas id="game"></canvas><script type="module" src="./__falls.js"></script></body></html>'],
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
await page.goto(`http://127.0.0.1:${port}/__falls.html`);
await page.waitForFunction(() => window.falls?.ready, null, { timeout: 60_000 });
const error = await page.evaluate(() => window.falls.error);
if (error) {
  console.error(error);
  process.exit(1);
}

if (flag('bench')) {
  for (const zoom of zooms) {
    const p = await page.evaluate((z) => window.falls.painter(z, 100), zoom);
    console.log(`painter alone, zoom ${zoom}: ${p.ms.toFixed(3)} ms a frame (sheet ${p.sheet.toFixed(3)}, foot ${p.foot.toFixed(3)}, lip ${p.lip.toFixed(3)})`);
  }
  for (const scene of scenes) {
    for (const zoom of zooms) {
      const r = await page.evaluate(([s, z]) => window.falls.bench({ scene: s, zoom: z, turn: 0, hour: 13, t: 20 }, 240), [scene, zoom]);
      console.log(`frame, ${scene} zoom ${zoom}: median ${r.median.toFixed(2)} ms, mean ${r.mean.toFixed(2)} ms`);
    }
  }
} else {
  for (const scene of scenes) {
    for (const hour of hours) {
      for (const zoom of scene === 'fountain' ? fzooms : zooms) {
        for (const turn of turns) {
          const name = `${prefix}-${scene}-${hour >= 6 && hour < 19 ? 'day' : 'night'}-z${zoom}-r${turn}`;
          await page.evaluate((s) => window.falls.shot(s), { scene, zoom, turn, hour, t });
          await page.screenshot({ path: join(out, `${name}.png`) });
          if (flag('pair')) {
            await page.evaluate((s) => window.falls.shot(s), { scene, zoom, turn, hour, t: t + 0.12 });
            await page.screenshot({ path: join(out, `${name}-b.png`) });
          }
          console.log(name);
        }
      }
    }
  }
}
await browser.close();
server.close();
