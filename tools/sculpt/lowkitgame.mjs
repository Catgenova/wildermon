// What is worn and held, from a figure's gear (the bows and their quiver, the shields, the tool belt, the ring, the
// pendant and the circlet among the rest) on the low-poly bodies in the game's own renderer: drawFigure with the
// "Sculpted figures" switch on, as the island draws a body (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL),
// the outfit taken from the gear as in play (`outfitOf`).
//
//   node tools/sculpt/lowkitgame.mjs --out <dir> --name <name> --gear '<GearLook JSON>' [--zoom 10] [--views front,q3,side,rq3,back]
//       [--gender man] [--hair swept] [--phase 1.5] [--fight <0..1 of a go, or a list>] [--go 2.4] [--walk] [--gif <view>] [--fps 12]
//       [--outfit '<FigurePose.outfit JSON>'] [--bg '#7d9b5e'] [--crop x0,y0,x1,y1]
//     writes <dir>/<name>-z<zoom>.png (the views side by side, each cropped to the box given as shares of its cell). --fight
//     stands it at a fight (job attack_creature) that far through a go of --go seconds, a row a moment for a list
//     (-t<percent>); --walk at a walk; --gif <view> one go of the fight (or one loop of the walk, or of the idle) from that view.
//   node tools/sculpt/lowkitgame.mjs --out <dir> --batch <jobs.json>
//     each job ({ name, gear, gender, hair, zoom, views, crop, fight, walk, outfit, phase }, the flags' names) in one page.
//
// Views: front (facing 0), q3 (1), side (2), rq3 (3), back (4), lq3 (5), lside (6), l3 (7). Playwright's Chromium
// (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel; the GIF needs Python's PIL (PYTHON, else
// python3).
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowkitgame'));
const FACING = { front: 0, q3: 1, side: 2, rq3: 3, back: 4, lq3: 5, lside: 6, l3: 7 };
const listOf = (v) => (Array.isArray(v) ? v : String(v).split(','));
/** A job from the flags, or from the batch file's entry with the flags as its defaults. */
const jobOf = (j = {}) => ({
  name: j.name ?? opt('name', 'kit'), zoom: +(j.zoom ?? opt('zoom', '10')), phase: +(j.phase ?? opt('phase', '1.5')), go: +(j.go ?? opt('go', '2.4')),
  views: listOf(j.views ?? opt('views', 'front,q3,side,back,rq3')).filter((v) => v in FACING),
  fights: (() => { const f = j.fight ?? opt('fight', ''); return f === '' ? [] : listOf(f).map(Number); })(),
  crop: j.crop ? listOf(j.crop).map(Number) : opt('crop', '') ? opt('crop', '').split(',').map(Number) : null,
  gif: j.gif ?? opt('gif', 'none'), fps: +(j.fps ?? opt('fps', '12')),
  P: {
    gender: j.gender ?? opt('gender', 'man'), hair: j.hair ?? opt('hair', 'swept'), hairColour: j.colour ?? opt('colour', 'brown'), walk: j.walk ?? flag('walk'),
    gear: j.gear ?? JSON.parse(opt('gear', '{}')), outfit: j.outfit ?? (opt('outfit', '') ? JSON.parse(opt('outfit', '{}')) : undefined), bg: j.bg ?? opt('bg', '#7d9b5e'),
  },
});
const jobs = opt('batch', '') ? JSON.parse(readFileSync(opt('batch', ''), 'utf8')).map(jobOf) : [jobOf()];
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { outfitOf } from './src/sculpt/lowpoly';
import { DEFAULT_LOOK } from './src/game/look';
import { CLIPS } from './src/sculpt/anim';
let P = {}, look = DEFAULT_LOOK;
window.setP = (q) => { P = q; look = { ...DEFAULT_LOOK, gender: P.gender, hair: P.hair, hairColour: P.hairColour, beard: 'none' }; };
const size = (zoom) => [Math.ceil(52 * zoom) + 30, Math.ceil(50 * zoom) + 24];
window.idleLength = () => CLIPS.idle.length;
window.cell = (zoom, facing, phase, moving = false, fight = -1, go = 2.4, crop = null) => {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = P.bg; g.fillRect(0, 0, cw, ch);
  const outfit = P.outfit ? { ...outfitOf(P.gear), ...P.outfit } : undefined;
  drawFigure(g, cw / 2, ch - 2 * zoom - 8, zoom, { phase, moving, facing, swimming: false, look, gear: P.gear, ...(outfit ? { outfit } : {}),
    ...(fight >= 0 ? { working: true, job: 'attack_creature', act: { t: fight * go, length: go } } : { working: false }) });
  if (!crop) return cv;
  const x0 = Math.round(crop[0] * cw), y0 = Math.round(crop[1] * ch), w = Math.round((crop[2] - crop[0]) * cw), h = Math.round((crop[3] - crop[1]) * ch);
  const o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(cv, x0, y0, w, h, 0, 0, w, h);
  return o;
};
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
window.show = (zoom, facings, phase, moving = false, fight = -1, go = 2.4, crop = null) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  for (const f of facings) { const c = window.cell(zoom, f, phase, moving, fight, go, crop); c.id = 'f' + f; root.appendChild(c); }
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.text()); });
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b}#root{display:inline-flex;gap:0}canvas{display:block}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const shot = async (sel, path) => {
    const r = await p.evaluate((q) => { const bb = document.querySelector(q).getBoundingClientRect(); return { x: bb.x, y: bb.y, width: Math.ceil(bb.width), height: Math.ceil(bb.height) }; }, sel);
    await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
    await p.screenshot({ path, clip: r, timeout: 180000 });
  };
  for (const J of jobs) {
    const { name, zoom, phase, go, views, fights, crop, P } = J;
    await p.evaluate((q) => window.setP(q), P);
    const moments = fights.length ? fights : [-1];
    if (views.length) for (const fm of moments) {
      const tag = fm >= 0 && fights.length > 1 ? `-t${Math.round(fm * 100)}` : '';
      await p.evaluate(([z, fs, ph, mv, f, g, c]) => window.show(z, fs, ph, mv, f, g, c), [zoom, views.map((v) => FACING[v]), phase, P.walk, fm, go, crop]);
      const f = join(out, `${name}${tag}-z${zoom}.png`);
      await shot('#root', f);
      console.log('wrote', f);
    }
    if (J.gif in FACING) {
      const len = await p.evaluate(() => window.idleLength()), n = fights.length ? Math.round(go * J.fps) : P.walk ? 16 : Math.round(len * J.fps), dir = join(out, 'gif-frames');
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      for (let k = 0; k < n; k++) {
        const ph = P.walk ? (2 * Math.PI * k) / n : fights.length ? phase : (6 * k * len) / n;
        await p.evaluate(([z, f, ph2, mv, fm, g, c]) => window.show(z, [f], ph2, mv, fm, g, c), [zoom, FACING[J.gif], ph, P.walk, fights.length ? k / n : -1, go, crop]);
        await shot(`#f${FACING[J.gif]}`, join(dir, `f${String(k).padStart(3, '0')}.png`));
      }
      const gif = join(out, `${name}-${fights.length ? 'fight' : P.walk ? 'walk' : 'idle'}-z${zoom}-${J.gif}.gif`);
      execFileSync(process.env.PYTHON ?? 'python3', ['-c', `
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
pal = fr[len(fr) // 2].quantize(colors=160, method=Image.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.NONE) for f in fr]
q[0].save(sys.argv[2], save_all=True, append_images=q[1:], duration=round(1000 / float(sys.argv[3])), loop=0, optimize=True)
`, dir, gif, String(J.fps)]);
      rmSync(dir, { recursive: true, force: true });
      console.log('wrote', gif, `(${n} frames)`);
    }
  }
} finally {
  await browser.close();
}
