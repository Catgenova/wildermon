// The outfit on the low-poly man in the game's own renderer: the swept-back undercut, the shawl, the tunic, the
// trousers and the boots, the hood down, the long sword wielded and so carried on the back, playing the idle clip.
// drawFigure with the "Sculpted figures" switch on, as the island draws a body (drawFigure -> drawSculptLive -> lowScene
// -> drawSculptGL), as tools/sculpt/lowhoodgame.mjs draws it.
//
//   node tools/sculpt/lowoutfitgame.mjs --out <dir> [--zoom 10] [--views front,q3,side,back,rq3] [--phase 1.5]
//       [--gif q3] [--fps 12] [--gender man] [--hair swept] [--hood] [--enchanted] [--cloth] [--walk] [--name outfit]
//     writes <dir>/<name>-z<zoom>-<view>.png for each view and <dir>/<name>-z<zoom>.png (the views side by side), and with
//     --gif one whole loop of the idle clip from that view at --fps (<dir>/<name>-idle-z<zoom>-<view>.gif); --gif none
//     skips it; --hood draws the hood up (the hair hidden under it), --enchanted the sword lit, --cloth the outfit's pieces
//     enchanted (outfit.enchanted: clothShawl, clothHood, clothTunic, clothTrousers, clothBoots), --walk the GIF of one
//     loop of the walk (<dir>/<name>-walk-z<zoom>-<view>.gif) in place of the idle's
//
// Views: front (facing 0), q3 (three-quarter, facing 1), side (facing 2), rq3 (rear three-quarter, facing 3), back
// (facing 4). Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel; the
// GIF needs Python's PIL.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowoutfitgame'));
const zoom = +opt('zoom', '10'), phase = +opt('phase', '1.5'), fps = +opt('fps', '12'), name = opt('name', 'outfit');
const FACING = { front: 0, q3: 1, side: 2, rq3: 3, back: 4 };
const views = opt('views', 'front,q3,side,back,rq3').split(',').filter((v) => v in FACING);
const gifView = opt('gif', 'q3');
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const pose = {
  gender: opt('gender', 'man'), hair: opt('hair', 'swept'), hairColour: opt('colour', 'brown'),
  hood: flag('hood'), enchanted: flag('enchanted'), cloth: flag('cloth'), walk: flag('walk'),
};
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
import { CLIPS } from './src/sculpt/anim';
const P = ${JSON.stringify(pose)};
const look = { ...DEFAULT_LOOK, gender: P.gender, hair: P.hair, hairColour: P.hairColour, beard: 'none' };
// the cell: the figure's box at this zoom, wide enough for the sword on the back
const size = (zoom) => [Math.ceil(44 * zoom) + 30, Math.ceil(48 * zoom) + 24];
window.idleLength = () => CLIPS.idle.length;
window.cell = (zoom, facing, phase, moving = false) => {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 2 * zoom - 8, zoom, { phase, moving, facing, swimming: false, working: false, look,
    gear: { weapon: { id: 'long_sword', ...(P.enchanted ? { enchanted: true } : {}) } },
    outfit: { hood: P.hood, ...(P.cloth ? { enchanted: { clothShawl: true, clothHood: true, clothTunic: true, clothTrousers: true, clothBoots: true } } : {}) } });
  return cv;
};
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
window.show = (zoom, facings, phase, moving = false) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  for (const f of facings) { const c = window.cell(zoom, f, phase, moving); c.id = 'f' + f; root.appendChild(c); }
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b}#root{display:inline-flex;gap:0}canvas{display:block}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  // (the page sized to the element first, so a row wider than the window is shot whole)
  const shot = async (sel, path) => {
    const r = await p.evaluate((q) => { const b = document.querySelector(q).getBoundingClientRect(); return { x: b.x, y: b.y, width: Math.ceil(b.width), height: Math.ceil(b.height) }; }, sel);
    await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
    await p.screenshot({ path, clip: r, timeout: 180000 });
  };
  if (views.length) {
    await p.evaluate(([z, fs, ph]) => window.show(z, fs, ph), [zoom, views.map((v) => FACING[v]), phase]);
    for (const v of views) { const f = join(out, `${name}-z${zoom}-${v}.png`); await shot(`#f${FACING[v]}`, f); console.log('wrote', f); }
    if (views.length > 1) { const f = join(out, `${name}-z${zoom}.png`); await shot('#root', f); console.log('wrote', f); }
  }
  if (gifView in FACING) {
    // one loop of the idle: its time is the figure's phase over six (no id, so no offset into the loop)
    // (the walk: one stride, the phase once round in 16 frames)
    const len = await p.evaluate(() => window.idleLength()), n = pose.walk ? 16 : Math.round(len * fps), dir = join(out, 'gif-frames');
    mkdirSync(dir, { recursive: true });
    for (let k = 0; k < n; k++) {
      await p.evaluate(([z, f, ph, mv]) => window.show(z, [f], ph, mv), [zoom, FACING[gifView], pose.walk ? (2 * Math.PI * k) / n : (6 * k * len) / n, pose.walk]);
      await shot(`#f${FACING[gifView]}`, join(dir, `f${String(k).padStart(3, '0')}.png`));
    }
    const gif = join(out, `${name}-${pose.walk ? 'walk' : 'idle'}-z${zoom}-${gifView}.gif`);
    // (cropped to what moves over the loop, a margin round it; one palette for the whole loop)
    execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image, ImageChops
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
bg = Image.new('RGB', fr[0].size, fr[0].getpixel((0, 0)))
box = None
for f in fr:
    b = ImageChops.difference(f, bg).getbbox()
    if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
m = 12; W, H = fr[0].size
box = (max(0, box[0] - m), max(0, box[1] - m), min(W, box[2] + m), min(H, box[3] + m))
fr = [f.crop(box) for f in fr]
pal = fr[len(fr) // 2].quantize(colors=128, method=Image.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.NONE) for f in fr]
q[0].save(sys.argv[2], save_all=True, append_images=q[1:], duration=round(1000 / float(sys.argv[3])), loop=0, optimize=True)
`, dir, gif, String(fps)]);
    rmSync(dir, { recursive: true, force: true });
    console.log('wrote', gif, `(${n} frames, ${fps} fps, ${len} s)`);
  }
} finally {
  await browser.close();
}
