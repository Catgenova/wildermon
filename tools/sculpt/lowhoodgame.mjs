// The outfit with the hood up on the low-poly male and female in the game's own renderer (the shawl, the trousers, the boots and the hood, tools/sculpt/garments/hood.mjs): drawFigure with the "Sculpted figures" switch
// on, as the island draws a body (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL), as tools/sculpt/lowwalk.mjs
// draws them. Both bodies, idle and walking, front (facing 0), three-quarter (facing 1), side (facing 2) and back (facing 4), at each zoom asked; and the
// walk as a looping GIF at one zoom.
//
//   node tools/sculpt/lowhoodgame.mjs --out <dir> [--zooms 1,5,10] [--gif 10] [--frames 12] [--name hood]
//     writes <dir>/hood-game-z<zoom>.png for each zoom (zoom 1 also four times larger, pixel for pixel, beside it) and
//     <dir>/hood-game-walk-z<gif>.gif (the man and the woman, front, three-quarter, side and back); --name the files' and the
//     title's garment (the game draws every garment worn: the shawl and the trousers)
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
const out = resolve(opt('out', 'tmp/lowhoodgame'));
const zooms = opt('zooms', '1,5,10').split(',').map(Number).filter((z) => z > 0);
const gifZoom = +opt('gif', '10'), F = +opt('frames', '12'), name = opt('name', 'hood');
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
const NAME = ${JSON.stringify(name === 'hood' ? 'The outfit with the hood up' : 'The ' + name)};
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: 'bald', beard: 'none' });
const size = (zoom) => [Math.max(80, Math.ceil(30 * zoom) + 30), Math.ceil(44 * zoom) + 24];
function cell(zoom, gender, facing, moving, phase) {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 2 * zoom - 8, zoom, { phase, moving, facing, swimming: false, working: false, look: look(gender) });
  return cv;
}
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
  for (const z of zooms) {
    await p.evaluate((zz) => window.sheet(zz), z);
    const file = join(out, `${name}-game-z${z}.png`);
    await (await p.$('#root')).screenshot({ path: file });
    console.log('wrote', file);
  }
  if (gifZoom > 0) {
    const dir = join(out, 'gif-frames');
    mkdirSync(dir, { recursive: true });
    for (let k = 0; k < F; k++) {
      await p.evaluate(([zz, u]) => window.frame(zz, u), [gifZoom, k / F]);
      await (await p.$('#frame')).screenshot({ path: join(dir, `f${String(k).padStart(2, '0')}.png`) });
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
