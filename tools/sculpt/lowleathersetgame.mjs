// The leather set worn whole (chest & arms, leggings, boots, shawl and hat) in the game's own renderer: drawFigure with
// the "Sculpted figures" switch on (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL), both bodies, plain and
// enchanted (every piece's outfit.enchanted), the long sword wielded.
//
//   node tools/sculpt/lowleathersetgame.mjs --out <dir> [--tag set] [--zooms 5,10] [--gif 8] [--views 0,1,2,4] [--fps 12]
//       [--looks plain,enchanted] [--still-only] [--gif-only] [--pieces leatherChest,leatherShawl,...]
//       [--stills 0,1,2,3,4] [--bodies man,woman] [--clips idle,walk,swing]
//     (--pieces: the set's pieces worn, by their outfit keys; all five by default; --stills the facings of the stills;
//     --bodies the bodies drawn; --clips the clips played)
//     <tag>-<look>-z<zoom>.png: both bodies front, three-quarter, side, rear three-quarter and back;
//     <tag>-<look>-<idle|walk|swing>-z<zoom>.gif: the idle, the walk and the two-handed swing (at work on a creature with
//       the long sword), both bodies from each of --views, each body and view played on its own in real time, frame by
//       frame (the animator keeps state per body and fades over real time), each frame taken from its canvas (toDataURL);
//     <tag>-<look>-<clip>-z<zoom>-sheet.png: the same frames, a few of each laid out as a sheet.
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL; the sheets and GIFs need Python's PIL (PY, default
// python3).
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowleathersetgame')), tag = opt('tag', 'set');
const zooms = opt('zooms', '5,10').split(',').map(Number).filter((z) => z > 0);
const gifZoom = +opt('gif', '8'), views = opt('views', '0,1,2,4').split(',').map(Number), fps = +opt('fps', '12');
const looks = opt('looks', 'plain,enchanted').split(',');
const clips = opt('clips', 'idle,walk,swing').split(',');
const stills = opt('stills', '0,1,2,3,4').split(',').map(Number), bodies = opt('bodies', 'man,woman').split(',');
const PY = process.env.PY ?? 'python3';
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const PIECES = opt('pieces', 'leatherChest,leatherLegs,leatherBoots,leatherShawl,leatherHat').split(',').filter(Boolean);
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
import { CLIPS } from './src/sculpt/anim';
const PIECES = ${JSON.stringify(PIECES)};
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' });
const size = (zoom) => [Math.ceil(56 * zoom), Math.ceil(64 * zoom)];
window.lengths = () => ({ idle: CLIPS.idle.length, swing: CLIPS.swing.length });
// (clip: 'still' | 'idle' | 'walk' | 'swing'; ph the walk's phase or the idle's time, t the swing's time)
window.cell = (zoom, gender, facing, clip, ph, enchanted) => {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  const outfit = { shawl: false, trousers: false, boots: false, tunic: false, hood: false, ...Object.fromEntries(PIECES.map((k) => [k, true])), enchanted: Object.fromEntries(PIECES.map((k) => [k, enchanted])) };
  const swing = clip === 'swing';
  drawFigure(g, cw / 2, ch - 2 * zoom - 8, zoom, { phase: swing ? 0 : ph, moving: clip === 'walk', facing, swimming: false, working: swing,
    ...(swing ? { job: 'attack_creature', act: { t: ph, length: CLIPS.swing.length } } : {}),
    gear: { weapon: { id: 'long_sword', material: 'iron', enchanted: false } }, look: look(gender), outfit });
  return cv.toDataURL('image/png');
};
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const save = (url, path) => writeFileSync(path, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
const COMPOSE = `
import sys, json
from PIL import Image
def compose(rows):
    ims = [[Image.open(f).convert('RGB') for f in r] for r in rows]
    W = max(sum(i.width for i in r) for r in ims); H = sum(max(i.height for i in r) for r in ims)
    s = Image.new('RGB', (W, H), (47, 41, 43)); y = 0
    for r in ims:
        x = 0
        for i in r: s.paste(i, (x, y)); x += i.width
        y += max(i.height for i in r)
    return s
`;
const sheet = (rows, path) => execFileSync(PY, ['-c', COMPOSE + `
compose(json.loads(sys.argv[1])).save(sys.argv[2])
`, JSON.stringify(rows), path]);
const gif = (frames, path, ms) => execFileSync(PY, ['-c', COMPOSE + `
fr = [compose(r) for r in json.loads(sys.argv[1])]
pal = fr[0].quantize(colors=200, method=Image.Quantize.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in fr]
q[0].save(sys.argv[2], save_all=True, append_images=q[1:], duration=int(sys.argv[3]), loop=0, optimize=True)
`, JSON.stringify(frames), path, String(ms)]);
try {
  const p = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><body></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const L = await p.evaluate(() => window.lengths());
  const tmp = join(out, `frames-${process.pid}`); mkdirSync(tmp, { recursive: true });
  for (const lk of looks) {
    const en = lk === 'enchanted';
    if (!flag('gif-only')) for (const z of zooms) {
      const rows = [];
      for (const g of bodies) {
        const row = [];
        for (const f of stills) {
          const path = join(tmp, `s-${lk}-${z}-${g}-${f}.png`);
          // (held a moment so the animator settles on the facing)
          for (let k = 0; k < 6; k++) { await p.evaluate((a) => window.cell(...a), [z, g, f, 'still', 1.5, en]); await p.waitForTimeout(60); }
          save(await p.evaluate((a) => window.cell(...a), [z, g, f, 'still', 1.5, en]), path); row.push(path);
        }
        rows.push(row);
      }
      const path = join(out, `${tag}-${lk}-z${z}.png`); sheet(rows, path); console.log('wrote', path);
    }
    if (!flag('still-only')) for (const clip of clips) {
      // one loop: the walk's stride (the phase once round), the idle's clip (its time the phase over six), the swing's clip
      const n = clip === 'walk' ? 16 : Math.round((clip === 'idle' ? L.idle : L.swing) * fps), ms = clip === 'walk' ? 70 : Math.round(1000 / fps), cells = {};
      for (const g of bodies) for (const f of views) {
        cells[`${g}${f}`] = [];
        // (a lead-in so the animator has faded into the clip before the frames kept)
        for (let k = 0; k < 8; k++) { await p.evaluate((a) => window.cell(...a), [gifZoom, g, f, clip, 0, en]); await p.waitForTimeout(ms); }
        for (let k = 0; k < n; k++) {
          const ph = clip === 'walk' ? (2 * Math.PI * k) / n : clip === 'idle' ? (6 * k * L.idle) / n : (k * L.swing) / n;
          const path = join(tmp, `${lk}-${clip}-${g}-${f}-${k}.png`);
          save(await p.evaluate((a) => window.cell(...a), [gifZoom, g, f, clip, ph, en]), path); cells[`${g}${f}`].push(path);
          await p.waitForTimeout(ms);
        }
      }
      const frames = Array.from({ length: n }, (_, k) => bodies.map((g) => views.map((f) => cells[`${g}${f}`][k])));
      const path = join(out, `${tag}-${lk}-${clip}-z${gifZoom}.gif`); gif(frames, path, ms); console.log('wrote', path);
      // (a sheet of four frames spread over the loop, each body and view)
      const pick = [0, 1, 2, 3].map((i) => Math.floor((i * n) / 4));
      const sp = join(out, `${tag}-${lk}-${clip}-z${gifZoom}-sheet.png`);
      sheet(bodies.flatMap((g) => pick.map((k) => views.map((f) => cells[`${g}${f}`][k]))), sp); console.log('wrote', sp);
    }
  }
  rmSync(tmp, { recursive: true, force: true });
} finally {
  await browser.close();
}
