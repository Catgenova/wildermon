// The leather set's leggings (tools/sculpt/garments/leatherlegs.mjs) in the game's own renderer: drawFigure with the
// "Sculpted figures" switch on (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL), as tools/sculpt/lowoutfitgame.mjs
// draws the first outfit, worn by both bodies in place of the first outfit's trousers (no tunic, shawl or hood; the first
// outfit's boots) or, with --set, the leather set's other pieces where this branch has them, the long sword wielded (on
// the back), playing the idle clip or walking.
//
//   node tools/sculpt/lowleatherlegsgame.mjs --out <dir> [--tag <name>] [--zooms 1,5,10] [--walk 5] [--frames 16] [--phase 1.5]
//       [--set leatherChest,leatherBoots,leatherShawl,leatherHat]
//     <tag>-z<zoom>.png: per zoom both bodies front, three-quarter, side, rear three-quarter and back, a row plain and a
//       row enchanted (outfit.enchanted.leatherLegs);
//     <tag>-walk-z<zoom>.gif: the walk at that zoom, both bodies, three-quarter and side, plain then enchanted.
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL; the GIF needs Python's PIL.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowleatherlegsgame')), tag = opt('tag', 'leatherlegs-game');
const set = opt('set', '').split(',').filter(Boolean);
const zooms = opt('zooms', '1,5,10').split(',').map(Number).filter((z) => z > 0), walkZoom = +opt('walk', '5'), F = +opt('frames', '16'), phase = +opt('phase', '1.5');
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
const SET = ${JSON.stringify(set)};
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' });
const size = (zoom) => [Math.ceil(44 * zoom) + 30, Math.ceil(48 * zoom) + 24];
window.cell = (zoom, gender, facing, moving, ph, enchanted) => {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 2 * zoom - 8, zoom, { phase: ph, moving, facing, swimming: false, working: false, look: look(gender),
    gear: { weapon: { id: 'long_sword' } },
    outfit: { leatherLegs: true, trousers: false, tunic: false, shawl: false, hood: false, ...Object.fromEntries(SET.map((k) => [k, true])), ...(SET.includes('leatherBoots') ? { boots: false } : {}), enchanted: Object.fromEntries(['leatherLegs', ...SET].map((k) => [k, enchanted])) } });
  return cv;
};
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
window.show = (cells) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  for (const row of cells) { const r = document.createElement('div'); r.className = 'row'; for (const c of row) r.appendChild(window.cell(...c)); root.appendChild(r); }
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b}#root{display:inline-block}.row{display:flex}canvas{display:block}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const shot = async (path) => {
    const r = await p.evaluate(() => { const b = document.getElementById('root').getBoundingClientRect(); return { x: b.x, y: b.y, width: Math.ceil(b.width), height: Math.ceil(b.height) }; });
    await p.setViewportSize({ width: Math.max(1200, r.width), height: Math.max(800, r.height) });
    await p.screenshot({ path, clip: r, timeout: 180000 });
  };
  const FACINGS = [0, 1, 2, 3, 4];
  for (const z of zooms) {
    const rows = [false, true].map((en) => ['man', 'woman'].flatMap((g) => FACINGS.map((f) => [z, g, f, false, phase, en])));
    await p.evaluate((c) => window.show(c), rows);
    const f = join(out, `${tag}-z${z}.png`); await shot(f); console.log('wrote', f);
  }
  if (walkZoom > 0) {
    const dir = join(out, `walk-frames-${process.pid}`); mkdirSync(dir, { recursive: true });
    for (let k = 0; k < F; k++) {
      const ph = (k / F) * Math.PI * 2;
      const rows = [false, true].map((en) => ['man', 'woman'].flatMap((g) => [1, 2].map((f) => [walkZoom, g, f, true, ph, en])));
      await p.evaluate((c) => window.show(c), rows);
      await shot(join(dir, `f${String(k).padStart(3, '0')}.png`));
    }
    const gif = join(out, `${tag}-walk-z${walkZoom}.gif`);
    execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
pal = fr[0].quantize(colors=160, method=Image.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.NONE) for f in fr]
q[0].save(sys.argv[2], save_all=True, append_images=q[1:], duration=70, loop=0, optimize=True)
`, dir, gif]);
    rmSync(dir, { recursive: true, force: true });
    console.log('wrote', gif);
  }
} finally {
  await browser.close();
}
