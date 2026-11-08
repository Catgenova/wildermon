// The leather set's feathered cap (tools/sculpt/garments/hat.mjs) over the first outfit, on the swept-back hair, on the
// low-poly male and female in the game's own renderer: drawFigure with the "Sculpted figures" switch on and the pose's
// outfit.leatherHat (outfit.enchanted.leatherHat with --enchanted), as the island draws a body (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL). Both bodies, idle
// and walking, front (facing 0), three-quarter (facing 1), side (facing 2) and back (facing 4), at each zoom asked; and
// the walk as a looping GIF at one zoom. (tools/sculpt/lowhoodgame.mjs, the hat worn in place of the hood.)
//
//   node tools/sculpt/lowhatgame.mjs --out <dir> [--zooms 1,5,10] [--gif 10] [--frames 12] [--enchanted] [--swing t1,t2,... [--swingzoom 8]]
//     --swing: the two-handed swing (src/sculpt/anim/clips/swing.ts, the long sword in hand) at those clip times, both
//     bodies, front, three-quarter, side and back, the hat alone (the first outfit off): <dir>/<name>-game-swing.png
//     writes <dir>/hat[-enchanted]-game-z<zoom>.png for each zoom (zoom 1 also four times larger beside it) and
//     <dir>/hat[-enchanted]-game-walk-z<gif>.gif
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, at one device pixel a canvas pixel; the GIF needs
// Python's PIL.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowhatgame'));
const zooms = opt('zooms', '1,5,10').split(',').map(Number).filter((z) => z > 0);
const swingT = opt('swing', '').split(',').filter(Boolean).map(Number), swingZoom = +opt('swingzoom', '8');
const gifZoom = +opt('gif', '10'), F = +opt('frames', '12'), ench = args.includes('--enchanted'), name = opt('name', ench ? 'hat-enchanted' : 'hat');
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
const NAME = ${JSON.stringify((ench ? 'The leather hat, enchanted,' : 'The leather hat') + ' over the first outfit')};
const ENCH = ${JSON.stringify(ench)};
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' });
const size = (zoom) => [Math.max(80, Math.ceil(30 * zoom) + 30), Math.ceil(44 * zoom) + 24];
function cell(zoom, gender, facing, moving, phase) {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 2 * zoom - 8, zoom, { phase, moving, facing, swimming: false, working: false, look: look(gender), outfit: { leatherHat: true, enchanted: { leatherHat: ENCH } } });
  return cv;
}
// the swing at clip time t: at work with the long sword, the hat alone
function swingCell(zoom, gender, facing, t) {
  const cw = Math.ceil(56 * zoom), ch = Math.ceil(64 * zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 2 * zoom - 8, zoom, { phase: 0, moving: false, facing, swimming: false, working: true, job: 'attack_creature', act: { t, length: 2 }, gear: { weapon: { id: 'long_sword', material: 'iron', enchanted: false } }, look: look(gender), outfit: { shawl: false, trousers: false, boots: false, tunic: false, hood: false, leatherHat: true, enchanted: { leatherHat: ENCH } } });
  return cv;
}
window.swing = (zoom, times) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab(NAME.replace(' over the first outfit', '') + ' in the swing (the long sword in hand), zoom ' + zoom + ': front, 3/4, side, back', 'h'));
  for (const t of times) for (const gender of ['man', 'woman']) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (const facing of [0, 1, 2, 4]) { const box = document.createElement('div'); box.className = 'c'; box.appendChild(swingCell(zoom, gender, facing, t)); box.appendChild(lab(gender + ' t ' + t.toFixed(2) + ' ' + ['front', '3/4', 'side', '', 'back'][facing])); row.appendChild(box); }
  }
};
const lab = (t, cls = 'l') => { const d = document.createElement('div'); d.className = cls; d.textContent = t; return d; };
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
// one zoom's sheet: the man and the woman, each idle and walking, front and three-quarter
window.sheet = (zoom) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab(NAME + ' in the game\\'s renderer (drawFigure, Sculpted figures on): zoom ' + zoom + ', one device pixel a canvas pixel', 'h'));
  const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
  const big = zoom <= 2 ? document.createElement('div') : null;
  if (big) { big.className = 'row'; root.appendChild(lab('the same, four times larger (nearest pixel)', 'h')); root.appendChild(big); }
  for (const gender of ['man', 'woman']) for (const [what, moving, phase] of [['idle', false, 1.5], ['walk', true, Math.PI / 2]]) for (const facing of [0, 1, 2, 4]) {
    const box = document.createElement('div'); box.className = 'c';
    const cv = cell(zoom, gender, facing, moving, phase);
    box.appendChild(cv); box.appendChild(lab(gender + ' ' + what + (['front', '3/4', 'side', '', 'back'][facing].replace(/^/, ' '))));
    row.appendChild(box);
    if (big) {
      const b2 = document.createElement('div'); b2.className = 'c';
      const c2 = document.createElement('canvas'); c2.width = cv.width * 4; c2.height = cv.height * 4;
      const g2 = c2.getContext('2d'); g2.imageSmoothingEnabled = false; g2.drawImage(cv, 0, 0, c2.width, c2.height);
      b2.appendChild(c2); b2.appendChild(lab(gender + ' ' + what + (['front', '3/4', 'side', '', 'back'][facing].replace(/^/, ' ')))); big.appendChild(b2);
    }
  }
};
// one frame of the walk: the man and the woman, front and three-quarter
window.frame = (zoom, u) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  const row = document.createElement('div'); row.className = 'row'; row.id = 'frame'; root.appendChild(row);
  for (const gender of ['man', 'woman']) for (const facing of [0, 1, 2, 4]) row.appendChild(cell(zoom, gender, facing, true, u * Math.PI * 2));
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:13px sans-serif;color:#eee}#root{display:inline-block;padding:4px}.row{display:flex;gap:6px;align-items:flex-start}.c{display:flex;flex-direction:column}.l{padding:2px 2px 6px}.h{padding:4px 2px;font-weight:600}canvas{display:block}#frame{gap:0}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  // (the page sized to the element first, so a sheet wider than the window is shot whole, without scrolling)
  const shot = async (sel, path) => {
    const r = await p.evaluate((q) => { const b = document.querySelector(q).getBoundingClientRect(); return { x: b.x, y: b.y, width: Math.ceil(b.width), height: Math.ceil(b.height) }; }, sel);
    await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
    await p.screenshot({ path, clip: r, timeout: 180000 });
  };
  for (const z of zooms) {
    await p.evaluate((zz) => window.sheet(zz), z);
    const file = join(out, `${name}-game-z${z}.png`);
    await shot('#root', file);
    console.log('wrote', file);
  }
  if (swingT.length) {
    await p.evaluate(([zz, ts]) => window.swing(zz, ts), [swingZoom, swingT]);
    const file = join(out, `${name}-game-swing.png`);
    await shot('#root', file);
    console.log('wrote', file);
  }
  if (gifZoom > 0) {
    const dir = join(out, 'gif-frames');
    mkdirSync(dir, { recursive: true });
    for (let k = 0; k < F; k++) {
      await p.evaluate(([zz, u]) => window.frame(zz, u), [gifZoom, k / F]);
      await shot('#frame', join(dir, `f${String(k).padStart(2, '0')}.png`));
    }
    const gif = join(out, `${name}-game-walk-z${gifZoom}.gif`);
    execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr = [f.resize((f.width * 2 // 3, f.height * 2 // 3), Image.LANCZOS) for f in fr]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=100, loop=0)
`, dir, gif]);
    rmSync(dir, { recursive: true, force: true });
    console.log('wrote', gif);
  }
} finally {
  await browser.close();
}
