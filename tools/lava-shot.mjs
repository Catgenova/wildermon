/**
 * Pictures of Volcano Isle's labyrinth of lava, drawn by the game's own renderer, map and hud on the island
 * `tools/lava-page.ts` builds: a way in by day and at night, the map today and tomorrow, the hud's heat meter at half
 * and full, the ten designs at the live island's size with their true paths, and the heart's seryll.
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
const [ex, ey] = await page.evaluate(() => window.lava.entrance(0));
const at = { x: ex, y: ey };
const shot = async (name, s) => {
  await page.evaluate((v) => window.lava.shot(v), { day: today, hour: 13, zoom: 1, t: 20, ...at, ...s });
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log(join(out, `${name}.png`));
};
// At the day's first way in, by day and at night, close and wider.
await shot('entrance-day', {});
await shot('entrance-night', { hour: 23 });
await shot('entrance-day-wide', { zoom: 0.45 });
await shot('entrance-night-wide', { zoom: 0.45, hour: 23 });
await shot('entrance-day-close', { zoom: 2 });
// The map, today and tomorrow.
for (const [name, day] of [['map-a', today], ['map-b', today + 1]]) {
  await page.evaluate((d) => window.lava.map(d), day);
  await page.screenshot({ path: join(out, `${name}.png`), clip: { x: 0, y: 0, width: 520, height: 640 } });
  console.log(join(out, `${name}.png`));
}
for (const [name, heat] of [['hud-half', 0.5], ['hud-full', 1]]) {
  await page.evaluate((h) => window.lava.hud(h), heat);
  await page.screenshot({ path: join(out, `${name}.png`), clip: { x: 0, y: 0, width: 360, height: 300 } });
  console.log(join(out, `${name}.png`));
}
// The ten designs on one sheet, and the heart's seryll.
for (const [name, fn] of [['designs', 'sheet'], ['seryll-heart', 'seryll']]) {
  const r = await page.evaluate((f) => window.lava[f](), fn);
  await page.setViewportSize({ width: Math.max(960, r.width), height: Math.max(640, r.height) });
  await page.evaluate((f) => window.lava[f](), fn);
  await page.screenshot({ path: join(out, `${name}.png`), clip: { x: 0, y: 0, width: r.width, height: r.height } });
  console.log(join(out, `${name}.png`), r.seams === undefined ? '' : `${r.seams} seryll seams`);
}
// The maps side by side, today on the left and tomorrow on the right.
const side = await context.newPage();
for (const [name, a, b, w, h] of [['map-two-days', 'map-a', 'map-b', 520, 640]]) {
  const img = (f) => `data:image/png;base64,${readFileSync(join(out, `${f}.png`)).toString('base64')}`;
  await side.setViewportSize({ width: w * 2 + 12, height: h + 28 });
  await side.setContent(`<body style="margin:0;background:#140f0c;color:#ffd9a0;font:14px system-ui;display:flex;gap:12px">${[[a, 'Today'], [b, 'Tomorrow']].map(([f, t]) =>
    `<figure style="margin:0"><figcaption style="height:28px;line-height:28px;padding-left:8px">${t}</figcaption><img src="${img(f)}" style="width:${w}px;height:${h}px;display:block"></figure>`).join('')}</body>`);
  await side.screenshot({ path: join(out, `${name}.png`) });
  console.log(join(out, `${name}.png`));
}
await browser.close();
server.close();
