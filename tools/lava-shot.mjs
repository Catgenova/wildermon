/**
 * Pictures of Volcano Isle's lava, drawn by the game's own renderer, map and hud on the cone `tools/lava-page.ts`
 * builds: the maze on the slopes by day and at night, two days side by side, the map with the day's lava on it, and
 * the hud's heat meter at half and full.
 *
 *   node tools/lava-shot.mjs --out /some/dir            # every picture, at twice the pixels
 *   node tools/lava-shot.mjs --out /some/dir --dpr 1
 *
 * Uses Playwright's Chromium (`/opt/pw-browsers/chromium` when it is there) and esbuild from node_modules; never
 * `playwright install`.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const out = resolve(opt('out', 'tmp/lava'));
const dpr = Number(opt('dpr', '2'));
mkdirSync(out, { recursive: true });

const ROOT = new URL('..', import.meta.url).pathname;
const bundled = await build({
  entryPoints: [join(ROOT, 'tools/lava-page.ts')], bundle: true, format: 'esm', write: false, logLevel: 'error', target: 'es2022',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const MADE = new Map([
  ['/__lava.js', bundled.outputFiles[0].text],
  ['/__lava.html', '<!doctype html><html data-ui="runecut"><head><meta charset="utf-8"><title>lava</title></head><body style="margin:0;background:#000"><script type="module" src="./__lava.js"></script></body></html>'],
]);
const server = createServer((req, res) => {
  const made = MADE.get(new URL(req.url ?? '/', 'http://x').pathname);
  if (!made) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': req.url.endsWith('.js') ? 'text/javascript' : 'text/html' }).end(made);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;

const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(kept) ? { executablePath: kept } : {});
const context = await browser.newContext({ viewport: { width: 960, height: 640 }, deviceScaleFactor: dpr });
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page threw:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
await page.goto(`http://127.0.0.1:${port}/__lava.html`);
for (const css of ['src/ui/tokens.css', 'src/style.css', 'src/ui/interior.css']) await page.addStyleTag({ content: readFileSync(join(ROOT, css), 'utf8') });
await page.waitForFunction(() => window.lava?.ready, null, { timeout: 120_000 });
const error = await page.evaluate(() => window.lava.error);
if (error) {
  console.error(error);
  process.exit(1);
}
const today = await page.evaluate(() => window.lava.today);
const at = { x: 492, y: 72 };
const shot = async (name, s) => {
  await page.evaluate((v) => window.lava.shot(v), { day: today, hour: 13, zoom: 1, t: 20, ...at, ...s });
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log(join(out, `${name}.png`));
};
await shot('slopes-day', {});
await shot('slopes-night', { hour: 23 });
await shot('slopes-day-wide', { zoom: 0.5 });
await shot('slopes-night-wide', { zoom: 0.5, hour: 23 });
await shot('slopes-day-close', { zoom: 2 });
// The whole cone, the maze on two days running: put side by side afterwards.
await shot('day-a', { zoom: 0.16, x: 520, y: 105 });
await shot('day-b', { zoom: 0.16, x: 520, y: 105, day: today + 1 });
for (const [name, day] of [['map-a', today], ['map-b', today + 1]]) {
  await page.evaluate((d) => window.lava.map(d), day);
  await page.screenshot({ path: join(out, `${name}.png`), clip: { x: 0, y: 0, width: 520, height: 640 } });
  console.log(join(out, `${name}.png`));
}
await page.evaluate(() => document.querySelectorAll('.win').forEach((e) => e.remove()));
for (const [name, heat] of [['hud-half', 0.5], ['hud-full', 1]]) {
  await page.evaluate((h) => window.lava.hud(h), heat);
  await page.screenshot({ path: join(out, `${name}.png`), clip: { x: 0, y: 0, width: 360, height: 300 } });
  console.log(join(out, `${name}.png`));
}
// Each pair side by side, today on the left and tomorrow on the right.
const side = await context.newPage();
for (const [name, a, b, w, h] of [['two-days', 'day-a', 'day-b', 960, 640], ['map-two-days', 'map-a', 'map-b', 520, 640]]) {
  const img = (f) => `data:image/png;base64,${readFileSync(join(out, `${f}.png`)).toString('base64')}`;
  await side.setViewportSize({ width: w * 2 + 12, height: h + 28 });
  await side.setContent(`<body style="margin:0;background:#140f0c;color:#ffd9a0;font:14px system-ui;display:flex;gap:12px">${[[a, 'Today'], [b, 'Tomorrow']].map(([f, t]) =>
    `<figure style="margin:0"><figcaption style="height:28px;line-height:28px;padding-left:8px">${t}</figcaption><img src="${img(f)}" style="width:${w}px;height:${h}px;display:block"></figure>`).join('')}</body>`);
  await side.screenshot({ path: join(out, `${name}.png`) });
  console.log(join(out, `${name}.png`));
}
await browser.close();
server.close();
