// The undergarment painted on the low-poly bodies (tools/sculpt/lowunder.mjs) in the game's own renderer: drawFigure with
// the "Sculpted figures" switch on (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL), as
// tools/sculpt/lowoutfitgame.mjs draws a body, bare and under the outfits that cover the pelvis or the chest.
//
//   node tools/sculpt/lowundergame.mjs --out <dir> [--tag under] [--zooms 5,10] [--outfits bare,first,...] [--gif 10]
//       [--gifs bare,first] [--views 1,2,4] [--fps 12] [--crop 0.5] [--facings 0,1,2,3,4] [--still-only] [--gif-only]
//     <tag>-<outfit>-z<zoom>.png: per outfit, both bodies front, three-quarter, side, rear three-quarter and back;
//     <tag>-<outfit>-<walk|idle>-z<zoom>.gif: per outfit in --gifs, the walk and the idle, both bodies from each of --views
//       (facings), each body and view played on its own in real time, frame by frame (the animator keeps state per body
//       and fades over real time), each frame taken from its canvas (toDataURL).
// Outfits: bare (nothing worn), first (the first outfit), trousers (its trousers and boots only), tunic (its tunic and
// boots, no trousers), leather (the leather set's leggings, boots, shawl and hat), plate (the plate set's chest, leggings,
// boots and helm), mantle (the plate set with the fur mantle). Playwright's Chromium (/opt/pw-browsers/chromium) with
// software GL; the sheets and GIFs need Python's PIL (PY, default python3).
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowundergame')), tag = opt('tag', 'under');
const zooms = opt('zooms', '5,10').split(',').map(Number).filter((z) => z > 0);
const NONE = { shawl: false, trousers: false, boots: false, tunic: false, hood: false };
const OUTFITS = {
  bare: NONE,
  first: {},
  trousers: { shawl: false, tunic: false },
  tunic: { shawl: false, trousers: false },
  leather: { ...NONE, leatherLegs: true, leatherBoots: true, leatherShawl: true, leatherHat: true },
  plate: { ...NONE, plateChest: true, plateLegs: true, plateBoots: true, plateHelm: true },
  mantle: { ...NONE, plateChest: true, plateLegs: true, plateBoots: true, plateMantle: true },
};
const outfits = opt('outfits', Object.keys(OUTFITS).join(',')).split(',').filter((o) => o in OUTFITS);
const gifZoom = +opt('gif', '10'), gifs = opt('gifs', 'bare').split(',').filter((o) => o in OUTFITS);
const gifViews = opt('views', '1,2,4').split(',').map(Number), fps = +opt('fps', '12');
const PY = process.env.PY ?? 'python3';
/** The share of each cell's width kept round its middle in the sheets (the figure without the room for a sword). */
const crop = +opt('crop', '1');
/** The facings drawn in the sheets (0 front, 1 three-quarter, 2 side, 3 rear three-quarter, 4 back). */
const facings = opt('facings', '0,1,2,3,4').split(',').map(Number);
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
import { CLIPS } from './src/sculpt/anim';
const OUTFITS = ${JSON.stringify(OUTFITS)};
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' });
const size = (zoom) => [Math.ceil(44 * zoom) + 30, Math.ceil(48 * zoom) + 24];
window.idleLength = () => CLIPS.idle.length;
window.cell = (zoom, gender, facing, moving, ph, outfit) => {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 2 * zoom - 8, zoom, { phase: ph, moving, facing, swimming: false, working: false, look: look(gender),
    ...(outfit === 'bare' ? {} : { gear: { weapon: { id: 'long_sword' } } }), outfit: OUTFITS[outfit] });
  return cv.toDataURL('image/png');
};
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const save = (url, path) => writeFileSync(path, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
/** Frames laid out as a sheet (rows of paths) or played as a GIF (a list of rows of paths per frame). */
const sheet = (rows, path) => execFileSync(PY, ['-c', `
import sys, json
from PIL import Image
rows = json.loads(sys.argv[1])
c = float(sys.argv[3])
def cut(i):
    w = i.width; k = int(w * (1 - c) / 2)
    return i.crop((k, 0, w - k, i.height))
ims = [[cut(Image.open(f).convert('RGB')) for f in r] for r in rows]
W = max(sum(i.width for i in r) for r in ims); H = sum(max(i.height for i in r) for r in ims)
s = Image.new('RGB', (W, H), (47, 41, 43)); y = 0
for r in ims:
    x = 0
    for i in r: s.paste(i, (x, y)); x += i.width
    y += max(i.height for i in r)
s.save(sys.argv[2])
`, JSON.stringify(rows), path, String(crop)]);
const gif = (frames, path, ms) => execFileSync(PY, ['-c', `
import sys, json
from PIL import Image
frames = json.loads(sys.argv[1])
c = float(sys.argv[4])
def cut(i):
    w = i.width; k = int(w * (1 - c) / 2)
    return i.crop((k, 0, w - k, i.height))
def compose(rows):
    ims = [[cut(Image.open(f).convert('RGB')) for f in r] for r in rows]
    W = max(sum(i.width for i in r) for r in ims); H = sum(max(i.height for i in r) for r in ims)
    s = Image.new('RGB', (W, H), (47, 41, 43)); y = 0
    for r in ims:
        x = 0
        for i in r: s.paste(i, (x, y)); x += i.width
        y += max(i.height for i in r)
    return s
fr = [compose(r) for r in frames]
pal = fr[0].quantize(colors=200, method=Image.Quantize.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in fr]
q[0].save(sys.argv[2], save_all=True, append_images=q[1:], duration=int(sys.argv[3]), loop=0, optimize=True)
`, JSON.stringify(frames), path, String(ms), String(crop)]);
try {
  const p = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><body></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const tmp = join(out, `frames-${process.pid}`); mkdirSync(tmp, { recursive: true });
  if (!flag('gif-only')) for (const o of outfits) for (const z of zooms) {
    const row = [];
    for (const g of ['man', 'woman']) for (const f of facings) {
      const path = join(tmp, `${o}-${z}-${g}-${f}.png`);
      save(await p.evaluate((a) => window.cell(...a), [z, g, f, false, 1.5, o]), path); row.push(path);
    }
    const path = join(out, `${tag}-${o}-z${z}.png`); sheet([row.slice(0, facings.length), row.slice(facings.length)], path); console.log('wrote', path);
  }
  if (!flag('still-only')) {
    const len = await p.evaluate(() => window.idleLength());
    for (const o of gifs) for (const walk of [true, false]) {
      // one loop: the walk's stride (the phase once round), the idle's clip (its time the phase over six)
      const n = walk ? 16 : Math.round(len * fps), ms = walk ? 70 : Math.round(1000 / fps), cells = {};
      for (const g of ['man', 'woman']) for (const f of gifViews) {
        cells[`${g}${f}`] = [];
        for (let k = 0; k < n; k++) {
          const ph = walk ? (2 * Math.PI * k) / n : (6 * k * len) / n, path = join(tmp, `${o}-${walk}-${g}-${f}-${k}.png`);
          save(await p.evaluate((a) => window.cell(...a), [gifZoom, g, f, walk, ph, o]), path); cells[`${g}${f}`].push(path);
          await p.waitForTimeout(ms);
        }
      }
      const frames = Array.from({ length: n }, (_, k) => ['man', 'woman'].map((g) => gifViews.map((f) => cells[`${g}${f}`][k])));
      const path = join(out, `${tag}-${o}-${walk ? 'walk' : 'idle'}-z${gifZoom}.gif`); gif(frames, path, ms); console.log('wrote', path);
    }
  }
  rmSync(tmp, { recursive: true, force: true });
} finally {
  await browser.close();
}
