// The plate leggings (tools/sculpt/garments/platelegs.mjs) on both low-poly bodies in the game's own renderer: drawFigure
// with the "Sculpted figures" switch on, as the island draws a body (drawFigure -> drawSculptLive -> lowScene ->
// drawSculptGL, its bloom included), plain and enchanted side by side, as tools/sculpt/lowplatebootsgame.mjs draws the
// boots.
//
//   node tools/sculpt/lowplatelegsgame.mjs --out <dir> [--zoom 10] [--views front,q3,side,back,rq3] [--phase 1.5]
//       [--name plate-legs-game] [--set] [--crop 0.6] [--gif side] [--fps 12]
//     <dir>/<name>-z<zoom>.png: for him then her, each view plain then enchanted (outfit.enchanted.legs), stood in the
//       idle; the first outfit off (the shawl, the tunic, the trousers, its boots), the leggings on the bare body; --crop k
//       keeps the lowest k of each cell; --set wears the rest of the plate set too (outfit.plateChest, plateBoots,
//       plateHelm, plateMantle: whichever this branch has);
//     with --gif <view>: <dir>/<name>-walk-z<zoom>-<view>.gif, one stride of the walk, both bodies plain and enchanted.
//
// Views: front (facing 0), q3 (facing 1), side (facing 2), rq3 (facing 3), back (facing 4). Playwright's Chromium
// (/opt/pw-browsers/chromium) with software GL; the GIF needs Python's PIL.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowplatelegsgame'));
const zoom = +opt('zoom', '10'), phase = +opt('phase', '1.5'), fps = +opt('fps', '12'), name = opt('name', 'plate-legs-game'), crop = +opt('crop', '1');
const FACING = { front: 0, q3: 1, side: 2, rq3: 3, back: 4 };
const views = opt('views', 'front,q3,side,back').split(',').filter((v) => v in FACING);
const gifView = opt('gif', 'none');
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const P = { set: flag('set') };
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
const P = ${JSON.stringify(P)};
const size = (zoom) => [Math.ceil(30 * zoom) + 24, Math.ceil(48 * zoom) + 24];
window.cell = (zoom, gender, facing, phase, lit, moving, crop) => {
  const look = { ...DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' };
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  const set = P.set ? { boots: false, plateChest: true, plateBoots: true, plateHelm: true, plateMantle: true } : { boots: false };
  drawFigure(g, cw / 2, ch - 2 * zoom - 8, zoom, { phase, moving, facing, swimming: false, working: false, look,
    outfit: { shawl: false, tunic: false, trousers: false, ...set, plateLegs: true, enchanted: { chest: lit, legs: lit, boots: lit, helm: lit, mantle: lit } } });
  if (crop >= 1) return cv;
  const h = Math.round(ch * crop), c2 = document.createElement('canvas'); c2.width = cw; c2.height = h;
  c2.getContext('2d').drawImage(cv, 0, ch - h, cw, h, 0, 0, cw, h);
  return c2;
};
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
window.show = (cells) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  for (const c of cells) root.appendChild(window.cell(...c));
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b}#root{display:inline-flex;gap:4px;background:#2f292b}canvas{display:block}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const shot = async (path) => {
    const r = await p.evaluate(() => { const b = document.querySelector('#root').getBoundingClientRect(); return { x: b.x, y: b.y, width: Math.ceil(b.width), height: Math.ceil(b.height) }; });
    await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
    await p.screenshot({ path, clip: r, timeout: 180000 });
  };
  if (views.length) {
    const cells = [];
    for (const gender of ['man', 'woman']) for (const v of views) for (const lit of [false, true]) cells.push([zoom, gender, FACING[v], phase, lit, false, crop]);
    await p.evaluate((c) => window.show(c), cells);
    const f = join(out, `${name}-z${zoom}.png`); await shot(f); console.log('wrote', f);
  }
  if (gifView in FACING) {
    const n = 16, dir = join(out, 'gif-frames');
    mkdirSync(dir, { recursive: true });
    for (let k = 0; k < n; k++) {
      const cells = [];
      for (const gender of ['man', 'woman']) for (const lit of [false, true]) cells.push([zoom, gender, FACING[gifView], (k / n) * Math.PI * 2, lit, true, crop]);
      await p.evaluate((c) => window.show(c), cells);
      await shot(join(dir, `f${String(k).padStart(3, '0')}.png`));
    }
    const gif = join(out, `${name}-walk-z${zoom}-${gifView}.gif`);
    execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
pal = fr[len(fr) // 2].quantize(colors=160, method=Image.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.NONE) for f in fr]
q[0].save(sys.argv[2], save_all=True, append_images=q[1:], duration=round(1000 / float(sys.argv[3])), loop=0, optimize=True)
`, dir, gif, String(fps)]);
    rmSync(dir, { recursive: true, force: true });
    console.log('wrote', gif);
  }
} finally {
  await browser.close();
}
