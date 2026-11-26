// A set of worn armour on the low-poly bodies in the game's own renderer (drawFigure, "Sculpted figures" on), for review:
// the metal sets (tools/sculpt/garments/metalsets.mjs) and the fur set.
//
//   node tools/sculpt/lowarmourgame.mjs --out <dir> --gear '<GearLook JSON>' [--tag name] [--zoom 4] [--glow '#ff8a34,#a6e6ff']
//     <dir>/<tag>-set.png: both bodies, front, 3/4, side, back 3/4, back; plain, then enchanted in each glow given;
//     <dir>/<tag>-move.png: both bodies in the walk (4 moments) and the long sword's swing (4 moments), 3/4 and side;
//     <dir>/<tag>-close.png (--close): the head and the feet up close, 3/4 and back, plain and enchanted.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowarmourgame'));
const tag = opt('tag', 'set');
const ZOOM = +opt('zoom', '4');
const gear = JSON.parse(opt('gear', '{}'));
const glows = opt('glow', '#ff8a34,#a6e6ff').split(',');
const what = new Set(opt('what', 'set,move').split(','));
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
import { clipFor } from './src/sculpt/anim';
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: gender === 'man' ? 'swept' : 'braid', beard: 'none' });
const BG = '#7d9b5e';
const lab = (t, cls = 'l') => { const d = document.createElement('div'); d.className = cls; d.textContent = t; return d; };
window.ready = async () => { sculptedFigures(true); const m = await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); if (window.preload) await window.preload(); };
function cell(zoom, p, w = 40, h = 64, foot = 14, crop) {
  const cw = Math.ceil(w * zoom), ch = Math.ceil(h * zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = BG; g.fillRect(0, 0, cw, ch);
  // (a close look: drawn crop.k times as large, the point crop.at pixels up from the feet in the middle)
  if (crop) drawFigure(g, cw / 2, ch / 2 + crop.at * zoom * crop.k, zoom * crop.k, p);
  else drawFigure(g, cw / 2, ch - foot * zoom, zoom, p);
  return cv;
}
const lit = (gear, glow) => Object.fromEntries(Object.entries(gear).map(([s, p]) => [s, glow && s !== 'weapon' ? { ...p, enchanted: true, glow } : p]));
const stood = (gender, facing, gear) => ({ phase: 0, moving: false, facing, swimming: false, working: false, gear, look: look(gender) });
window.set = (zoom, gear, glows, title) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab(title + ' -- both bodies, the game renderer, zoom ' + zoom + ': front, 3/4, side, back 3/4, back; plain, then enchanted ' + glows.join(', '), 'h'));
  for (const gender of ['man', 'woman']) for (const glow of [null, ...glows]) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (const [facing, v] of [[0, 'front'], [1, '3/4'], [2, 'side'], [3, 'back 3/4'], [4, 'back']]) {
      const b = document.createElement('div'); b.className = 'c'; b.appendChild(cell(zoom, stood(gender, facing, lit(gear, glow)))); b.appendChild(lab(gender + ' ' + (glow ?? 'plain') + ' ' + v)); row.appendChild(b);
    }
  }
};
window.close = (zoom, gear, glow, title) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab(title + ' -- close: head and feet, 3/4, side and back, plain and enchanted ' + glow, 'h'));
  for (const gender of ['man', 'woman']) for (const [part, at] of [['head', 40], ['body', 26], ['feet', 4]]) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (const g of [null, glow]) for (const [facing, v] of [[1, '3/4'], [2, 'side'], [4, 'back']]) {
      const b = document.createElement('div'); b.className = 'c'; b.appendChild(cell(zoom, stood(gender, facing, lit(gear, g)), 30, 30, 14, { k: 2.4, at })); b.appendChild(lab(gender + ' ' + part + ' ' + (g ?? 'plain') + ' ' + v)); row.appendChild(b);
    }
  }
};
window.move = (zoom, gear, title) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab(title + ' -- the walk (4 moments) and the long sword swing (4 moments), 3/4 and side', 'h'));
  const swing = (gender, facing, t) => ({ phase: 0, moving: false, facing, swimming: false, working: true, job: 'attack_creature', act: { t, length: 2 }, gear: { ...gear, weapon: { id: 'long_sword', material: 'iron' } }, look: look(gender) });
  for (const gender of ['man', 'woman']) for (const facing of [1, 2]) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (let k = 0; k < 4; k++) { const p = { ...stood(gender, facing, gear), moving: true, phase: (2 * Math.PI * k) / 4 + 0.3 }; const b = document.createElement('div'); b.className = 'c'; b.appendChild(cell(zoom, p)); b.appendChild(lab(gender + ' walk ' + k)); row.appendChild(b); }
    for (const t of [0.35, 0.7, 1.0, 1.35]) { const b = document.createElement('div'); b.className = 'c'; b.appendChild(cell(zoom, swing(gender, facing, t))); b.appendChild(lab(gender + ' swing ' + t)); row.appendChild(b); }
  }
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: +opt('dpr', '1') });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:12px sans-serif;color:#eee}#root{display:inline-block;padding:4px;width:max-content}.row{display:flex;gap:4px;align-items:flex-end}.c{display:flex;flex-direction:column;flex-shrink:0}.l{padding:1px 2px 4px}.h{padding:4px 2px;font-weight:600}canvas{display:block}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const shot = async (path) => {
    const r = await p.evaluate(() => { const bb = document.querySelector('#root').getBoundingClientRect(); return { x: bb.x, y: bb.y, width: Math.ceil(bb.width), height: Math.ceil(bb.height) }; });
    await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
    await p.screenshot({ path, clip: r, timeout: 600000 });
    console.log('wrote', path, `${r.width}x${r.height}`);
  };
  // (a set loaded on demand: drawn once, waited for, so the picture is of it)
  const warm = async () => { await p.evaluate(([z, g]) => window.set(z, g, [], ''), [1, gear]); await p.waitForTimeout(+opt('wait', '1500')); };
  await warm();
  if (what.has('set')) { await p.evaluate(([z, g, gl, t]) => window.set(z, g, gl, t), [ZOOM, gear, glows, tag]); await shot(join(out, `${tag}-set.png`)); }
  if (what.has('move')) { await p.evaluate(([z, g, t]) => window.move(z, g, t), [+opt('movezoom', '3'), gear, tag]); await shot(join(out, `${tag}-move.png`)); }
  if (what.has('close')) { await p.evaluate(([z, g, gl, t]) => window.close(z, g, gl, t), [ZOOM, gear, glows[0], tag]); await shot(join(out, `${tag}-close.png`)); }
} finally {
  await browser.close();
}
