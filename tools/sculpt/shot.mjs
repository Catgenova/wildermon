// Sheets of a sculpted body (src/sculpt), drawn by tools/sculpt/page.ts at twice the pixels:
//
//   node tools/sculpt/shot.mjs --out /some/dir                 # every sheet: lineup, facings, motion, close, night, debug, stats
//   node tools/sculpt/shot.mjs --out /some/dir --only lineup,close    # also: design, garment, overlay, live, iou, hands, stats
//   node tools/sculpt/shot.mjs --out /some/dir --who female     # the woman (default male; also neither, seven, five)
//   node tools/sculpt/shot.mjs --out /some/dir --hair bald      # the look's hairstyle: tousled (default) or bald
//   node tools/sculpt/shot.mjs --out /some/dir --ink 0          # the ink's width in px on every sheet (0: none), for looking at the shapes alone
//   node tools/sculpt/shot.mjs --stats                          # the bake's numbers and the cost of a crowd, no sheets
//
// Uses Playwright's Chromium at /opt/pw-browsers/chromium with software GL, and esbuild from node_modules; never `playwright install`.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const flag = (name) => args.includes(`--${name}`);
const out = resolve(opt('out', 'tmp/sculpt'));
const who = opt('who', 'male');
const hair = opt('hair', 'tousled'); // the look's hairstyle: tousled (the sheet's) or bald
const pitch = opt('pitch', ''); // the head's pitch up on the island, degrees, in place of the sculpt's own
const ink = opt('ink', ''); // the ink's width in screen px for every sheet, in place of the renderer's own (0 for none)
const only = opt('only', 'compare,lineup,facings,motion,close,night,debug').split(',');
mkdirSync(out, { recursive: true });

const ROOT = new URL('../..', import.meta.url).pathname;
const bundled = await build({
  entryPoints: [join(ROOT, 'tools/sculpt/page.ts')], bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
  absWorkingDir: ROOT,
});
const js = bundled.outputFiles[0].text;
const refPath = join(ROOT, 'docs/aesthetic/07-player-poncho-sheet.jpg');
const ref = existsSync(refPath) ? `data:image/jpeg;base64,${readFileSync(refPath).toString('base64')}` : '';
const ref8Path = join(ROOT, 'docs/aesthetic/08-male-body-proportions.jpg');
const ref8 = existsSync(ref8Path) ? `data:image/jpeg;base64,${readFileSync(ref8Path).toString('base64')}` : '';
const ref9Path = join(ROOT, 'docs/aesthetic/09-female-body-proportions.jpg');
const ref9 = existsSync(ref9Path) ? `data:image/jpeg;base64,${readFileSync(ref9Path).toString('base64')}` : '';
const ref10Path = join(ROOT, 'docs/aesthetic/10-player-design-sheet.jpg');
const ref10 = existsSync(ref10Path) ? `data:image/jpeg;base64,${readFileSync(ref10Path).toString('base64')}` : '';

const kept = '/opt/pw-browsers/chromium';
const b = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 2000, height: 1000 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('ERR')) console.log('console', m.text()); });
await p.setContent(`<html><body style="margin:0;background:#2a2622"><div id=root style="display:inline-block;padding:4px"></div><script>window.REF=${JSON.stringify(ref)};window.REF8=${JSON.stringify(ref8)};window.REF9=${JSON.stringify(ref9)};window.REF10=${JSON.stringify(ref10)};window.HAIR=${JSON.stringify(hair)};window.INK=${ink === '' ? 'undefined' : +ink};window.PITCH=${pitch === '' ? 'undefined' : +pitch}</script></body></html>`);
await p.addScriptTag({ content: js });
await p.waitForFunction('window.READY');
console.log('gl:', await p.evaluate(() => window.SCULPT.glInfo()));

const shoot = async (name, fn, arg) => {
  await p.evaluate(() => window.SCULPT.clear());
  await p.evaluate(fn, arg ?? who);
  await p.locator('#root').screenshot({ path: join(out, `${name}.png`), timeout: 180000, animations: 'disabled' });
  console.log('wrote', join(out, `${name}.png`));
};

if (flag('stats') || only.includes('stats')) {
  for (const w of ['male', 'female', 'seven', 'five']) {
    const s = await p.evaluate((w) => window.SCULPT.stats(w), w);
    console.log(w, JSON.stringify(s, null, 1));
    for (const zoom of [1, 2, 4]) {
      const r = await p.evaluate(([w, z]) => window.SCULPT.bench(w, 20, 6, z), [w, zoom]);
      console.log(`${w} zoom ${zoom}: crowd of 20 ${r.msPerFrame.toFixed(1)} ms/frame, ${r.msPerBody.toFixed(2)} ms/body (band ${r.band})`);
    }
  }
  for (const zoom of [1, 2, 4]) {
    const r = await p.evaluate((z) => window.SCULPT.benchFigure(20, 6, z), zoom);
    console.log(`2D figure zoom ${zoom}: crowd of 20 ${r.msPerFrame.toFixed(1)} ms/frame, ${r.msPerBody.toFixed(2)} ms/body`);
  }
  if (flag('stats')) { await b.close(); process.exit(0); }
}
if (only.includes('compare')) await shoot(`compare-${who}`, async (w) => { await window.SCULPT.compare(w, 6.5); });
if (only.includes('design')) await shoot(`design-${who}`, async (w) => { await window.SCULPT.design(w); });
if (only.includes('garment')) await shoot(`garment-${who}`, async (w) => { await window.SCULPT.garment(w); });
if (only.includes('overlay')) { await p.evaluate(() => window.SCULPT.clear()); const r = await p.evaluate((w) => window.SCULPT.overlay(w), who); console.log(`overlay ${who}`, JSON.stringify(r)); await p.locator('#root').screenshot({ path: join(out, `overlay-${who}.png`), timeout: 180000, animations: 'disabled' }); console.log('wrote', join(out, `overlay-${who}.png`)); }
if (only.includes('live')) { await p.evaluate(() => window.SCULPT.clear()); const r = await p.evaluate((w) => window.SCULPT.live(w, 2, 12), who); console.log(`live ${who}`, JSON.stringify(r)); await p.locator('#root').screenshot({ path: join(out, `live-${who}.png`), timeout: 180000, animations: 'disabled' }); console.log('wrote', join(out, `live-${who}.png`)); }
if (only.includes('compare') || only.includes('iou')) { await p.evaluate(() => window.SCULPT.clear()); const r = await p.evaluate((w) => window.SCULPT.iou(w), who); console.log(`iou ${who}`, JSON.stringify(r)); await p.locator('#root').screenshot({ path: join(out, `iou-${who}.png`), timeout: 180000, animations: 'disabled' }); console.log('wrote', join(out, `iou-${who}.png`)); }
if (only.includes('lineup')) await shoot('lineup', async () => { await window.SCULPT.lineup(6, 'idle:0'); await window.SCULPT.lineup(2.5, 'walk:0.25'); });
if (only.includes('facings')) await shoot(`facings-${who}`, (w) => { window.SCULPT.facings(w, 'idle:0', 1); window.SCULPT.facings(w, 'walk:0.25', 1); window.SCULPT.facings(w, 'idle:0', 2); window.SCULPT.facings(w, 'walk:0.25', 2); window.SCULPT.facings(w, 'idle:0', 4); window.SCULPT.facings(w, 'walk:0.6', 4); window.SCULPT.facings('figure', 'idle:0', 2); });
if (only.includes('motion')) await shoot(`motion-${who}`, (w) => { window.SCULPT.strip(w, 1, 2.5); window.SCULPT.strip(w, 3, 2.5); window.SCULPT.strip(w, 6, 2.5); window.SCULPT.strip('figure', 1, 2.5); });
if (only.includes('close')) await shoot(`close-${who}`, (w) => window.SCULPT.close(w, 9));
if (only.includes('hands')) { await shoot(`hands-${who}`, (w) => window.SCULPT.hands(w, 20)); for (const a of await p.evaluate(() => window.SCULPT.audit())) console.log('audit', JSON.stringify(a)); }
if (only.includes('trace')) {
  // The head and the hand alone for the overlays on the pictures: each cell's png with where its landmarks fell, as json.
  const marks = {};
  for (const [name, fn] of [['head-front', (w) => window.SCULPT.headShot(w, 0, 150)], ['head-34', (w) => window.SCULPT.headShot(w, 20, 150)], ['head-34b', (w) => window.SCULPT.headShot(w, 35, 150)], ['hand', (w) => window.SCULPT.handShot(w, 120, 90)]]) {
    await p.evaluate(() => window.SCULPT.clear());
    marks[name] = await p.evaluate(fn, who);
    await p.locator('#root canvas').first().screenshot({ path: join(out, `trace-${name}-${who}.png`), timeout: 180000, animations: 'disabled' });
    console.log('wrote', join(out, `trace-${name}-${who}.png`));
  }
  writeFileSync(join(out, `trace-${who}.json`), JSON.stringify(marks));
}
if (only.includes('night')) await shoot(`night-${who}`, (w) => { window.SCULPT.facings(w, 'idle:0', 3, { night: 1 }); window.SCULPT.facings(w, 'walk:0.25', 3, { night: 1 }); });
if (only.includes('debug')) await shoot(`debug-${who}`, (w) => { window.SCULPT.debug(w, 6, 1, 'walk:0.25'); window.SCULPT.debug(w, 6, 3, 'idle:0'); window.SCULPT.debug(w, 6, 5, 'work:0.5'); });
// One debug row of a pose at a zoom: --debug zoom,facing,what (e.g. --debug 14,2,idle:0).
const dbg = opt('debug', '');
if (dbg) { const [z, fc, what] = dbg.split(','); await shoot(`debug-${who}-${fc}`, ([w, z, fc, what]) => window.SCULPT.debug(w, +z, +fc, what), [who, z, fc, what]); }
await b.close();
