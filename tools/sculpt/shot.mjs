// Sheets of a sculpted body (src/sculpt), drawn by tools/sculpt/page.ts at twice the pixels:
//
//   node tools/sculpt/shot.mjs --out /some/dir                 # every sheet: lineup, facings, motion, close, night, debug, stats
//   node tools/sculpt/shot.mjs --out /some/dir --only lineup,close
//   node tools/sculpt/shot.mjs --out /some/dir --who five       # the island's proportions (default seven)
//   node tools/sculpt/shot.mjs --stats                          # the bake's numbers and the cost of a crowd, no sheets
//
// Uses Playwright's Chromium at /opt/pw-browsers/chromium with software GL, and esbuild from node_modules; never `playwright install`.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const flag = (name) => args.includes(`--${name}`);
const out = resolve(opt('out', 'tmp/sculpt'));
const who = opt('who', 'seven');
const only = opt('only', 'lineup,facings,motion,close,night,debug').split(',');
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

const kept = '/opt/pw-browsers/chromium';
const b = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 2000, height: 1000 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('ERR')) console.log('console', m.text()); });
await p.setContent(`<html><body style="margin:0;background:#2a2622"><div id=root style="display:inline-block;padding:4px"></div><script>window.REF=${JSON.stringify(ref)}</script></body></html>`);
await p.addScriptTag({ content: js });
await p.waitForFunction('window.READY');
console.log('gl:', await p.evaluate(() => window.SCULPT.glInfo()));

const shoot = async (name, fn) => {
  await p.evaluate(() => window.SCULPT.clear());
  await p.evaluate(fn, who);
  await p.locator('#root').screenshot({ path: join(out, `${name}.png`), timeout: 180000, animations: 'disabled' });
  console.log('wrote', join(out, `${name}.png`));
};

if (flag('stats') || only.includes('stats')) {
  for (const w of ['seven', 'five']) {
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
if (only.includes('lineup')) await shoot('lineup', async () => { await window.SCULPT.lineup(6, 'idle:0'); await window.SCULPT.lineup(2.5, 'walk:0.25'); });
if (only.includes('facings')) await shoot(`facings-${who}`, (w) => { window.SCULPT.facings(w, 'idle:0', 1); window.SCULPT.facings(w, 'walk:0.25', 1); window.SCULPT.facings(w, 'idle:0', 2); window.SCULPT.facings(w, 'walk:0.25', 2); window.SCULPT.facings(w, 'idle:0', 4); window.SCULPT.facings(w, 'walk:0.6', 4); window.SCULPT.facings('figure', 'idle:0', 2); });
if (only.includes('motion')) await shoot(`motion-${who}`, (w) => { window.SCULPT.strip(w, 1, 2.5); window.SCULPT.strip(w, 3, 2.5); window.SCULPT.strip(w, 6, 2.5); window.SCULPT.strip('figure', 1, 2.5); });
if (only.includes('close')) await shoot(`close-${who}`, (w) => window.SCULPT.close(w, 9));
if (only.includes('night')) await shoot(`night-${who}`, (w) => { window.SCULPT.facings(w, 'idle:0', 3, { night: 1 }); window.SCULPT.facings(w, 'walk:0.25', 3, { night: 1 }); });
if (only.includes('debug')) await shoot(`debug-${who}`, (w) => { window.SCULPT.debug(w, 6, 1, 'walk:0.25'); window.SCULPT.debug(w, 6, 3, 'idle:0'); window.SCULPT.debug(w, 6, 5, 'work:0.5'); });
await b.close();
