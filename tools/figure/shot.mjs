// Pictures of the player's body under each way of painting it (`FIGURE_STYLE` in src/render/figure.ts), drawn by
// tools/figure/page.ts at twice the pixels, beside the reference pictures.
//
//   node tools/figure/shot.mjs --out /some/dir --modes current,claire,best        # one sheet, every mode named, then the references
//   node tools/figure/shot.mjs --out /some/dir --modes claire --each               # a sheet a mode: figure-<mode>.png
//   node tools/figure/shot.mjs --out /some/dir --modes claire --night --brief      # by night too; only the game row and the close-ups
//   node tools/figure/shot.mjs --out /some/dir --refs a.png,b.jpg --modes best     # with these pictures as the references
//   node tools/figure/shot.mjs --bench --modes current,smooth,claire --n 20       # ms a frame for a crowd of each
//
// A mode is a preset (current, smooth, warm, grain, ink_even, ink_weighted, pixel, face, claire, best, best_soft) or the
// style's own fields, `shade=claire,ink=even,grain=0.04`.
//
// Uses Playwright's Chromium (`/opt/pw-browsers/chromium` when it is there) and esbuild from node_modules; never `playwright install`.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);
const out = resolve(opt('out', 'tmp/figure'));
const modes = opt('modes', 'current,claire,best').split(',');
const dpr = Number(opt('dpr', '2'));
mkdirSync(out, { recursive: true });

const ROOT = new URL('../..', import.meta.url).pathname;
const bundled = await build({
  entryPoints: [join(ROOT, 'tools/figure/page.ts')], bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const js = bundled.outputFiles[0].text;

const refs = (opt('refs', '') || '').split(',').filter(Boolean).map((p) => {
  const ext = extname(p).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return { name: basename(p), url: `data:${mime};base64,${readFileSync(resolve(p)).toString('base64')}` };
});

const kept = '/opt/pw-browsers/chromium';
const b = await chromium.launch(existsSync(kept) ? { executablePath: kept } : {});
async function page(scale) {
  const p = await b.newPage({ viewport: { width: 1900, height: 900 }, deviceScaleFactor: scale });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
  await p.setContent(`<html><body style="margin:0;background:#2a2622"><div id=root style="display:inline-block;padding-bottom:8px"></div><script>window.REFS=${JSON.stringify(refs)}</script></body></html>`);
  await p.addScriptTag({ content: js });
  await p.waitForFunction('window.READY');
  return p;
}

if (flag('bench')) {
  const p = await page(1);
  const n = Number(opt('n', '20')), frames = Number(opt('frames', '20')), zoom = Number(opt('zoom', '1'));
  for (const m of modes) {
    const runs = [];
    for (let q = 0; q < 3; q++) runs.push(await p.evaluate(([m, n, frames, zoom]) => window.figure.bench(m, n, frames, zoom), [m, n, frames, zoom]));
    const med = (k) => runs.map((r) => r[k]).sort((x, y) => x - y)[1];
    console.log(`${m}: ${n} drawn through the mesh ${med('fresh').toFixed(1)} ms a frame (${(med('fresh') / n).toFixed(2)} ms each); as the island keeps them ${med('game').toFixed(2)} ms a frame`);
  }
} else if (flag('each')) {
  for (const m of modes) {
    const p = await page(dpr);
    await p.evaluate(([m, night, brief]) => window.figure.sheet({ modes: [m], night, brief }), [m, flag('night'), flag('brief')]);
    await p.waitForFunction('window.DONE');
    const file = join(out, `figure-${m.replace(/[^a-z0-9_]+/gi, '_')}.png`);
    await p.locator('#root').screenshot({ path: file });
    console.log(file);
    await p.close();
  }
} else {
  const p = await page(dpr);
  await p.evaluate(([modes, night, brief]) => window.figure.sheet({ modes, night, brief }), [modes, flag('night'), flag('brief')]);
  await p.waitForFunction('window.DONE');
  const file = join(out, opt('name', 'figure-sheet.png'));
  await p.locator('#root').screenshot({ path: file });
  console.log(file);
}
await b.close();
