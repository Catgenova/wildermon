// Pictures of the ogre subspecies (`src/render/wild-ogre.ts`), drawn by tools/ogre/page.ts at twice the pixels.
//
//   node tools/ogre/shot.mjs --out /some/dir                 # ogre-A.png, ogre-B.png, ogre-C.png, the close-ups and ogre-lineup.png
//   node tools/ogre/shot.mjs --out /some/dir --only A        # one subspecies (A Menhir, B Gatebreaker, C Barrowback): sheet and close-up
//   node tools/ogre/shot.mjs --bench                          # ms a frame for a crowd of each
//
// Uses Playwright's Chromium (`/opt/pw-browsers/chromium` when it is there) and esbuild from node_modules; never `playwright install`.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);
const out = resolve(opt('out', 'tmp/ogre'));
const only = opt('only', 'A,B,C').split(',');
const dpr = Number(opt('dpr', '2'));
mkdirSync(out, { recursive: true });

const ROOT = new URL('../..', import.meta.url).pathname;
const bundled = await build({
  entryPoints: [join(ROOT, 'tools/ogre/page.ts')], bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const js = bundled.outputFiles[0].text;

const kept = '/opt/pw-browsers/chromium';
const b = await chromium.launch(existsSync(kept) ? { executablePath: kept } : {});
async function page(scale) {
  const p = await b.newPage({ viewport: { width: 1900, height: 800 }, deviceScaleFactor: scale });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
  await p.setContent('<html><body style="margin:0;background:#2a2622"><div id=root style="display:inline-block;padding-bottom:8px"></div></body></html>');
  await p.addScriptTag({ content: js });
  await p.waitForFunction('window.READY');
  return p;
}

if (opt('audit')) {
  // --audit A -- every facing against the standing loop, walk, run and strike.
  const poses = ['stand:0', 'stand:4.5', 'stand:9.2', 'stand:15.4', 'stand:18', 'walk:0', 'walk:0.25', 'walk:0.5', 'walk:0.75', 'run:0', 'run:0.25', 'run:0.5', 'run:0.75',
    ...[0.06, 0.19, 0.31, 0.44, 0.56, 0.69, 0.81, 0.94].map((t) => `strike:${t}`)];
  for (const id of opt('audit').split(',')) {
    const p = await page(1);
    await p.evaluate(([id, poses]) => window.ogre.audit(id, poses), [id, poses]);
    await p.locator('#root').screenshot({ path: join(out, `audit-${id}.png`) });
    console.log(join(out, `audit-${id}.png`));
    await p.close();
  }
} else if (opt('strip')) {
  // --strip 'A:2:strike:0.3,strike:0.5;B:1:stand:0' -- a row a body, a facing, then its poses.
  const p = await page(1);
  for (const spec of opt('strip').split(';')) {
    const [id, f, ...rest] = spec.split(':');
    const poses = rest.join(':').split(',');
    await p.evaluate(([id, f, poses]) => window.ogre.strip(id, Number(f), poses), [id, f, poses]);
  }
  await p.locator('#root').screenshot({ path: join(out, 'strip.png') });
  console.log(join(out, 'strip.png'));
} else if (flag('bench')) {
  const p = await page(1);
  const n = Number(opt('n', '24')), frames = Number(opt('frames', '20'));
  for (const id of only) {
    const runs = [];
    for (let q = 0; q < 3; q++) runs.push(await p.evaluate(([id, n, frames]) => window.ogre.bench(id, n, frames), [id, n, frames]));
    const med = (k) => runs.map((r) => r[k]).sort((x, y) => x - y)[1];
    if (flag('detail')) console.log(runs[0].detail);
    console.log(`${id}: ${runs[0].parts} pieces, ${runs[0].faces} faces; ${n} drawn through the mesh ${med('fresh').toFixed(1)} ms a frame (${(med('fresh') / n).toFixed(2)} ms each); as the island puts them down ${med('game').toFixed(2)} ms a frame`);
  }
} else {
  for (const id of only) {
    for (const [fn, name] of [['sheet', `ogre-${id}.png`], ['close', `ogre-${id}-close.png`]]) {
      const p = await page(dpr);
      await p.evaluate(([fn, id]) => window.ogre[fn](id), [fn, id]);
      await p.locator('#root').screenshot({ path: join(out, name) });
      await p.close();
      console.log(join(out, name));
    }
  }
  if (!flag('nolineup')) {
    const p = await page(dpr);
    await p.evaluate(() => window.ogre.lineup());
    await p.locator('#root').screenshot({ path: join(out, 'ogre-lineup.png') });
    console.log(join(out, 'ogre-lineup.png'));
  }
}
await b.close();
