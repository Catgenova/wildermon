// The bows (src/sculpt/assets/<bow>.json, tools/sculpt/gear/bow.mjs), their quiver and their arrow alone, in the game's
// own renderer (lowPropDraw -> drawSculptGL), each bow in the woods it is made of and in none, plain and enchanted, from
// its back (the face toward the mark) and from its side.
//
//   node tools/sculpt/lowbowshot.mjs --out <file.png> [--zoom 5]
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowbowshot.png')), ZOOM = +opt('zoom', '5');
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { lowPropDraw } from './src/sculpt/lowpoly';
import { drawSculptGL } from './src/sculpt/gl';
import { sculptedFigures } from './src/render/figure';
const BG = '#7d9b5e';
const lab = (t, cls = 'l') => { const d = document.createElement('div'); d.className = cls; d.textContent = t; return d; };
function cell(id, piece, yaw, zoom, part) {
  const d = lowPropDraw(id, piece, yaw, part), w = Math.ceil(40 * zoom), h = Math.ceil(46 * zoom);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  drawSculptGL(g, w / 2, h - 4 * zoom, zoom, d, { dpr: 1 });
  const px = g.getImageData(0, 0, w, h).data;
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const o = document.createElement('canvas'), pad = 8; o.width = Math.max(40, x1 - x0 + 1 + pad * 2); o.height = y1 - y0 + 1 + pad * 2;
  const og = o.getContext('2d'); og.fillStyle = BG; og.fillRect(0, 0, o.width, o.height);
  og.drawImage(cv, x0, y0, x1 - x0 + 1, y1 - y0 + 1, (o.width - (x1 - x0 + 1)) / 2, pad, x1 - x0 + 1, y1 - y0 + 1);
  return o;
}
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
window.sheet = (zoom) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('The bows in the game\\'s renderer: back (toward the mark) and side, in each wood, plain and enchanted; the quiver and the arrow', 'h'));
  const BOWS = [['short_bow', 'willow'], ['medium_bow', 'birch'], ['long_bow', 'oak'], ['composite_bow', null]];
  for (const [id, own] of BOWS) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (const [mat, lit] of [[own, false], [own, true], ['cherry', false], ['pine', false], [null, false]]) for (const [yaw, v] of [[90, 'back'], [0, 'side']]) {
      if (mat === null && own === null && lit) continue;
      const box = document.createElement('div'); box.className = 'c';
      box.appendChild(cell(id, { id, ...(mat ? { material: mat } : {}), ...(lit ? { enchanted: true } : {}) }, yaw, zoom));
      box.appendChild(lab(id + ' ' + (mat ?? 'none') + (lit ? ' lit' : '') + ' ' + v)); row.appendChild(box);
    }
  }
  const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
  for (const [lit, yaw, v] of [[false, 90, 'face'], [true, 90, 'face lit'], [false, 0, 'side'], [false, 200, 'back']]) { const box = document.createElement('div'); box.className = 'c'; box.appendChild(cell('long_bow', { id: 'long_bow', ...(lit ? { enchanted: true } : {}) }, yaw, zoom * 1.6, 'quiver')); box.appendChild(lab('quiver ' + v)); row.appendChild(box); }
  for (const yaw of [0, 60]) { const box = document.createElement('div'); box.className = 'c'; box.appendChild(cell('long_bow', { id: 'long_bow', material: 'iron' }, yaw, zoom * 1.6, 'arrow')); box.appendChild(lab('arrow')); row.appendChild(box); }
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:13px sans-serif;color:#eee}#root{display:inline-block;padding:4px}.row{display:flex;gap:6px;align-items:flex-end;margin-bottom:6px}.c{display:flex;flex-direction:column}.l{padding:2px}.h{padding:4px 2px;font-weight:600}canvas{display:block}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  await p.evaluate((z) => window.sheet(z), ZOOM);
  const r = await p.evaluate(() => { const bb = document.querySelector('#root').getBoundingClientRect(); return { x: 0, y: 0, width: Math.ceil(bb.width), height: Math.ceil(bb.height) }; });
  await p.setViewportSize({ width: Math.max(1600, r.width), height: Math.max(1000, r.height) });
  await p.screenshot({ path: out, clip: r, timeout: 180000 });
  console.log('wrote', out);
} finally {
  await browser.close();
}
