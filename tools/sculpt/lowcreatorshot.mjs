// The character creator (src/ui/creator.ts) on a page of its own, as the account page shows it (its rules
// src/ui/creator.css and the account page's src/account.css), a hairstyle's tile chosen: screenshots of each body, the
// whole creator and the mirror's head close-up, played in real time (the mirror's idle and the sculpted bodies' load).
//
//   node tools/sculpt/lowcreatorshot.mjs --out <dir> [--hair bob]
//     writes <dir>/creator-<hair>-<man|woman>.png and <dir>/creator-<hair>-<man|woman>-head.png
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowcreator')), hair = opt('hair', 'bob');
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { Creator } from './src/ui/creator';
import { DEFAULT_LOOK } from './src/game/look';
window.make = (gender) => {
  document.body.innerHTML = '';
  const c = new Creator({ ...DEFAULT_LOOK, gender }, () => true);
  const box = document.createElement('div'); box.style.cssText = 'width:1000px;padding:12px;background:#2a2430'; box.appendChild(c.el); document.body.appendChild(box);
  window.creator = c; c.wake();
};
`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const css = ['src/account.css', 'src/ui/creator.css'].map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n');
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent(`<!doctype html><html><head><style>${css}\nbody{display:block;margin:0;padding:16px;background:#1d1a1f;min-height:0}</style></head><body></body></html>`);
  await p.addScriptTag({ content: b.outputFiles[0].text });
  // (the page clipped to the element: the mirror redraws every frame, so it is never "stable" for an element shot)
  const shot = async (sel, path) => { const r = await p.evaluate((q) => { const e = document.querySelector(q).getBoundingClientRect(); return { x: e.x, y: e.y, width: Math.ceil(e.width), height: Math.ceil(e.height) }; }, sel); await p.screenshot({ path, clip: r, timeout: 120000, animations: 'allow' }); };
  for (const gender of ['man', 'woman']) {
    await p.evaluate((g) => window.make(g), gender);
    await p.waitForTimeout(4000);
    // the hairstyle's tile, by its name
    const name = await p.evaluate((h) => { const n = { bob: 'Bob', swept: 'Swept back', braid: 'Braid', bald: 'Bald' }[h]; const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === n || x.getAttribute('aria-label') === n || x.title === n); if (b) { b.click(); return n; } return null; }, hair);
    if (!name) console.log('no tile found for', hair, await p.evaluate(() => [...document.querySelectorAll('button')].map((x) => x.textContent.trim() || x.getAttribute('aria-label')).join(' | ')));
    await p.waitForTimeout(2500);
    const file = join(out, `creator-${hair}-${gender}.png`);
    await shot('.cr', file);
    console.log('wrote', file);
    await p.evaluate(() => document.querySelector('.cr-close').click());
    await p.waitForTimeout(2500);
    const head = join(out, `creator-${hair}-${gender}-head.png`);
    await shot('.cr-me', head);
    console.log('wrote', head);
  }
} finally {
  await browser.close();
}
