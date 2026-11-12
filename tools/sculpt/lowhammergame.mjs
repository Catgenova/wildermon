// The warhammer (src/sculpt/assets/warhammer.json, drawn for the maul) in the game's own renderer: drawFigure with the
// "Sculpted figures" switch on, a fight with the maul in hand (job attack_creature, gear.weapon maul), as the island draws
// a body (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL), so the overhead swing (src/sculpt/anim/clips/swing.ts)
// plays with the warhammer in both hands.
//
//   node tools/sculpt/lowhammergame.mjs --out <dir> [--zooms 3,8] [--times 0.84,1.34,1.62,1.7,1.8] [--gif 8] [--secs 3.4]
//     stills: <dir>/warhammer-game-z<zoom>.png, both bodies, plain and enchanted, front, three-quarter, side and back, at
//     those clip times (a blow the clip's own length, 2 s; no id: posed with nothing kept);
//     the swing played: <dir>/warhammer-game-<man|woman>-<view>-z<gif>.gif, each body and view played on its own on the
//     page's clock (the body's id kept, so the animator fades as the game's does; idle, then the blow from the clock's
//     time, one blow every --secs, the maul's), each frame saved off the canvas (toDataURL); him plain, her enchanted; and
//     <dir>/warhammer-game-swing-z<gif>.gif, all eight side by side.
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, at one device pixel a canvas pixel; the GIFs need
// Python's PIL (PYTHON, else python3).
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowhammergame'));
const zooms = opt('zooms', '3,8').split(',').map(Number).filter((z) => z > 0);
const times = opt('times', '0.84,1.34,1.62,1.7,1.8').split(',').map(Number);
const gifZoom = +opt('gif', '8'), SECS = +opt('secs', '3.4');
const PY = process.env.PYTHON ?? 'python3';
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
const SECS = ${SECS};
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: 'bald', beard: 'none' });
const VIEWS = [[0, 'front'], [1, '3/4'], [2, 'side'], [4, 'back']];
const pose = (gender, facing, t, lit, id, length = SECS) => ({ id, phase: 0, moving: false, facing, swimming: false, working: true, job: 'attack_creature', act: { t, length }, gear: { weapon: { id: 'maul', material: 'iron', enchanted: lit } }, look: look(gender) });
const size = (zoom) => [Math.ceil(52 * zoom), Math.ceil(64 * zoom)];
function cell(zoom, p) {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 12 * zoom, zoom, p);
  return cv;
}
const lab = (t, cls = 'l') => { const d = document.createElement('div'); d.className = cls; d.textContent = t; return d; };
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
window.stills = (zoom, times) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('The maul (the Runestone Warhammer) in the overhead swing, the game\\'s renderer, zoom ' + zoom + ': front, 3/4, side, back', 'h'));
  for (const [gender, lit] of [['man', false], ['man', true], ['woman', false], ['woman', true]]) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (const t of times) for (const [facing, v] of VIEWS) { const box = document.createElement('div'); box.className = 'c'; box.appendChild(cell(zoom, pose(gender, facing, t, lit, undefined, 2))); box.appendChild(lab(gender + (lit ? ' lit' : '') + ' t ' + t.toFixed(2) + ' ' + v)); row.appendChild(box); }
  }
};
// one body and one view played for a blow and a quarter on the page's clock: the clock (performance.now, which the figure
// and the animator's fades read) put forward 40 ms a frame, so every frame is drawn at its own moment however long the
// software renderer takes over it; stood idle for its first 0.3 s, then the blow, faded into as the game fades it
window.play = (zoom, gender, facing, lit, secs) => {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'), id = 'ham-' + gender + '-' + facing + '-' + Math.random(), frames = [], IDLE = 0.3, DT = 0.04;
  const real = performance.now.bind(performance), t0 = real();
  let clock = t0;
  performance.now = () => clock;
  try {
    for (let el = 0; el < IDLE + secs; el += DT) {
      clock = t0 + el * 1000;
      const t = el - IDLE, p = t < 0 ? { ...pose(gender, facing, 0, lit, id), working: false, job: undefined, act: undefined } : pose(gender, facing, t % SECS, lit, id);
      g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
      drawFigure(g, cw / 2, ch - 12 * zoom, zoom, p);
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(gender + (lit ? ' (enchanted) ' : ' (plain) ') + ['front', '3/4', 'side', '', 'back'][facing] + (t < 0 ? '  idle' : '  t ' + (t % SECS).toFixed(2) + 's'), 6, 14);
      frames.push({ at: el, url: cv.toDataURL('image/png') });
    }
  } finally { performance.now = real; }
  return frames;
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:13px sans-serif;color:#eee}#root{display:inline-block;padding:4px}.row{display:flex;gap:6px;align-items:flex-start}.c{display:flex;flex-direction:column}.l{padding:2px 2px 6px}.h{padding:4px 2px;font-weight:600}canvas{display:block}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const shot = async (sel, path) => {
    const r = await p.evaluate((q) => { const bb = document.querySelector(q).getBoundingClientRect(); return { x: bb.x, y: bb.y, width: Math.ceil(bb.width), height: Math.ceil(bb.height) }; }, sel);
    await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
    await p.screenshot({ path, clip: r, timeout: 180000 });
  };
  for (const z of zooms) {
    await p.evaluate(([zz, ts]) => window.stills(zz, ts), [z, times]);
    const file = join(out, `warhammer-game-z${z}.png`);
    await shot('#root', file);
    console.log('wrote', file);
  }
  if (gifZoom > 0) {
    const gifs = [];
    for (const [gender, lit] of [['man', false], ['woman', true]]) for (const [facing, v] of [[0, 'front'], [1, '34'], [2, 'side'], [4, 'back']]) {
      const frames = await p.evaluate(([zz, gg, ff, ll, ss]) => window.play(zz, gg, ff, ll, ss), [gifZoom, gender, facing, lit, SECS * 1.25]);
      const dir = join(out, `.frames-${gender}-${v}`); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
      frames.forEach((f, i) => writeFileSync(join(dir, `f${String(i).padStart(4, '0')}-${Math.round(f.at * 1000)}.png`), Buffer.from(f.url.split(',')[1], 'base64')));
      const gif = join(out, `warhammer-game-${gender}-${v}-z${gifZoom}.gif`);
      execFileSync(PY, ['-c', `
import sys, glob, os
from PIL import Image
fs = sorted(glob.glob(sys.argv[1] + '/f*.png'))
at = [int(os.path.basename(f).split('-')[1][:-4]) for f in fs]
fr = [Image.open(f).convert('RGB') for f in fs]
du = [max(20, at[i + 1] - at[i]) for i in range(len(at) - 1)] + [60]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=du, loop=0)
print('wrote', sys.argv[2], len(fr), 'frames over', round(at[-1] / 1000, 2), 's')
`, dir, gif], { stdio: 'inherit' });
      gifs.push(dir);
    }
    // all eight side by side, resampled to one clock (50 ms a frame)
    const all = join(out, `warhammer-game-swing-z${gifZoom}.gif`);
    execFileSync(PY, ['-c', `
import sys, glob, os, bisect
from PIL import Image
dirs, out = sys.argv[1:-1], sys.argv[-1]
seqs = []
for d in dirs:
  fs = sorted(glob.glob(d + '/f*.png')); seqs.append(([int(os.path.basename(f).split('-')[1][:-4]) for f in fs], fs))
end = min(s[0][-1] for s in seqs)
w, h = Image.open(seqs[0][1][0]).size
fr = []
for ms in range(0, end, 50):
  o = Image.new('RGB', (w * 4, h * 2))
  for k, (at, fs) in enumerate(seqs):
    i = max(0, bisect.bisect_right(at, ms) - 1)
    o.paste(Image.open(fs[i]).convert('RGB'), ((k % 4) * w, (k // 4) * h))
  fr.append(o.quantize(colors=255, method=Image.Quantize.MEDIANCUT))
fr[0].save(out, save_all=True, append_images=fr[1:], duration=50, loop=0)
print('wrote', out, len(fr), 'frames')
`, ...gifs, all], { stdio: 'inherit' });
    for (const d of gifs) rmSync(d, { recursive: true, force: true });
  }
} finally {
  await browser.close();
}
