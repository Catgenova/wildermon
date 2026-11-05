/**
 * Sheets of the goblin's three subspecies (`GOBLIN_RUNECUT`), drawn by the game's
 * own renderer on the page `tools/goblin-page.ts` builds: for each look its
 * turns, poses and variants close up, then at game zoom by day and by night;
 * a lineup of all three beside revamped wildermon; and
 * the cost of drawing a crowd of them.
 *
 *   node tools/goblin-shot.mjs --out /some/dir                 # goblin-<look>.png and goblin-<look>-close.png for A, B, C; goblin-lineup.png
 *   node tools/goblin-shot.mjs --looks A --out /some/dir       # one look's sheet
 *   node tools/goblin-shot.mjs --bench --n 24                  # ms for a crowd of 24, each look, drawn afresh and on the island
 *   node tools/goblin-shot.mjs --fresh --rounds 6              # ms a goblin drawn afresh, the looks taken in turn round after round
 *   node tools/goblin-shot.mjs --pieces --looks C              # what each piece of a look costs
 *   node tools/goblin-shot.mjs --big '[["A",1,0,-1]]' --name a.png   # looks big: look, turn, clock, strike (-1 none)
 *   node tools/goblin-shot.mjs --refs '[["tinka",0,1]]'        # wildermon big: species, stage, turn
 *   node tools/goblin-shot.mjs --frames --looks A --motions strike   # every turn at regular steps through a motion
 *
 * Pictures at a device pixel ratio of 2 unless `--dpr` says otherwise. Uses
 * Playwright's Chromium (`/opt/pw-browsers/chromium` when it is there) and
 * esbuild from node_modules; never `playwright install`.
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
const flag = (name) => args.includes(`--${name}`);
const out = resolve(opt('out', 'tmp/goblin'));
const looks = opt('looks', 'A,B,C').split(',');
const dpr = Number(opt('dpr', '2'));
mkdirSync(out, { recursive: true });

const ROOT = new URL('..', import.meta.url).pathname;
const bundled = await build({
  entryPoints: [join(ROOT, 'tools/goblin-page.ts')], bundle: true, format: 'esm', write: false, logLevel: 'error', target: 'es2022',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const MADE = new Map([
  ['__gob.js', bundled.outputFiles[0].text],
  ['__gob.html', '<!doctype html><html><head><meta charset="utf-8"><title>goblin</title></head><body style="margin:0;background:#20232a"><script type="module" src="./__gob.js"></script></body></html>'],
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
await page.goto(`http://127.0.0.1:${port}/__gob.html`);
await page.waitForFunction(() => window.gob?.ready, null, { timeout: 120_000 });
const error = await page.evaluate(() => window.gob.error);
if (error) {
  console.error(error);
  process.exit(1);
}

if (flag('fresh')) {
  // Each look drawn afresh in turn, round after round, so a busy moment on the machine falls on all of them alike; the least of
  // each look's rounds is its cost.
  const rounds = Number(opt('rounds', '6'));
  for (const lod of [1, 0]) {
    const best = Object.fromEntries(looks.map((l) => [l, Infinity]));
    for (let r = 0; r < rounds; r++) {
      for (const look of looks) best[look] = Math.min(best[look], await page.evaluate(([l, d]) => window.gob.fresh(l, d), [look, lod]));
    }
    console.log(`lod ${lod}, ms a goblin drawn afresh (least of ${rounds} rounds of 25 frames of 16):`, looks.map((l) => `${l} ${best[l].toFixed(2)}${l === looks[0] ? '' : ` (${best[l] / best[looks[0]] >= 1 ? '+' : ''}${((best[l] / best[looks[0]] - 1) * 100).toFixed(0)}%)`}`).join(', '));
  }
} else if (flag('pieces')) {
  for (const look of looks) {
    const r = await page.evaluate((l) => window.gob.pieces(l), look);
    console.log(look, r.map(([k, ms]) => `${k} ${ms.toFixed(2)}`).join(', '));
  }
} else if (flag('bench')) {
  const n = Number(opt('n', '24'));
  for (const look of looks) {
    const r = await page.evaluate(([l, k]) => window.gob.bench(l, k), [look, n]);
    console.log(`${look}: ${n} drawn afresh ${r.fresh.toFixed(2)} ms a frame (${r.picture.toFixed(3)} ms a goblin); island, ${n} about, steady ${r.island.toFixed(2)} ms; all going ${r.islandGo.toFixed(2)} ms`);
  }
} else if (flag('frames')) {
  // Every frame of each motion at regular steps, every turn: <look>-<motion>.png for each.
  for (const look of looks) {
    for (const motion of opt('motions', 'idle,walk,run,strike').split(',')) {
      await page.evaluate(([l, m]) => window.gob.frames(l, m), [look, motion]);
      await page.evaluate(() => { document.getElementById('game').style.visibility = 'hidden'; });
      await page.locator('#sheet').screenshot({ path: join(out, `${look}-${motion}.png`) });
      console.log(join(out, `${look}-${motion}.png`));
    }
  }
} else if (flag('big')) {
  await page.evaluate((l) => window.gob.big(l), JSON.parse(opt('big', '[]')));
  await page.evaluate(() => { document.getElementById('game').style.visibility = 'hidden'; });
  await page.locator('#sheet').screenshot({ path: join(out, opt('name', 'big.png')) });
} else if (flag('refs')) {
  await page.evaluate((l) => window.gob.refs(l), JSON.parse(opt('refs', '[]')));
  await page.evaluate(() => { document.getElementById('game').style.visibility = 'hidden'; });
  await page.locator('#sheet').screenshot({ path: join(out, 'refs.png') });
} else {
  const shoot = async (name) => {
    await page.evaluate(() => { document.getElementById('game').style.visibility = 'hidden'; });
    const box = await page.locator('#sheet').boundingBox();
    await page.setViewportSize({ width: Math.max(1400, Math.ceil(box.width)), height: Math.ceil(box.height) });
    await page.locator('#sheet').screenshot({ path: join(out, `${name}.png`) });
    const close = page.locator('#close');
    if (await close.count()) await close.screenshot({ path: join(out, `${name}-close.png`) });
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.evaluate(() => { document.getElementById('game').style.visibility = 'visible'; });
    console.log(join(out, `${name}.png`));
  };
  for (const look of looks) {
    await page.evaluate((l) => window.gob.sheet(l), look);
    await shoot(`goblin-${look}`);
  }
  if (!flag('nolineup')) {
    await page.evaluate(() => window.gob.lineup());
    await shoot('goblin-lineup');
  }
}
await browser.close();
server.close();
