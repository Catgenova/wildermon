// The bob (tools/sculpt/lowbob.mjs, src/sculpt/assets/lowhair.json 'bob') on the low-poly man and woman in the game's own
// renderer: drawFigure with the "Sculpted figures" switch on, as the island draws a body. Both bodies bare (no outfit),
// idle and walking, front (facing 0), three-quarter (1), side (2) and back (4); under the leather hat and the plate
// helm; in the two-handed swing; and a turntable of each body (the eight facings, idle) as a GIF.
//
//   node tools/sculpt/lowbobgame.mjs --out <dir> [--zoom 10] [--hair bob] [--only sheet,gear,swing,turn,walk]
//     sheet: <dir>/bob-game-z<zoom>.png; gear: <dir>/bob-gear-z<zoom>.png (the leather hat, the plate helm);
//     swing: <dir>/bob-swing.png (the long sword's swing at six clip times); turn: <dir>/bob-turn-<man|woman>.gif;
//     walk: <dir>/bob-walk.gif
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel; the GIFs need
// Python's PIL (PY, else python3).
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowbobgame')), zoom = +opt('zoom', '10'), hair = opt('hair', 'bob'), only = opt('only', 'sheet,gear,swing,turn,walk').split(',');
const PY = process.env.PY ?? 'python3';
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
const HAIR = ${JSON.stringify(hair)};
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: HAIR });
const BARE = { shawl: false, trousers: false, boots: false, tunic: false, hood: false };
const FACES = ['front', '3/4', 'side', '', 'back'];
function cell(zoom, gender, facing, moving, phase, outfit = BARE, extra = {}, w = 34, h = 48) {
  const cw = Math.ceil(w * zoom), ch = Math.ceil(h * zoom) + 24, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 2 * zoom - 8, zoom, { phase, moving, facing, swimming: false, working: false, look: look(gender), outfit, ...extra });
  return cv;
}
// the head close: the top of a cell cropped
function head(cv, zoom, gender) { const s = gender === 'man' ? 1 : 0.88, base = cv.height - 2 * zoom - 8, top = Math.round(base - 41.5 * zoom * s), hh = Math.round(15 * zoom * s), w = Math.round(16 * zoom * s); const c = document.createElement('canvas'); c.width = w; c.height = hh; c.getContext('2d').drawImage(cv, Math.round(cv.width / 2 - w / 2), top, w, hh, 0, 0, w, hh); return c; }
const lab = (t, cls = 'l') => { const d = document.createElement('div'); d.className = cls; d.textContent = t; return d; };
const box = (cv, text) => { const b = document.createElement('div'); b.className = 'c'; b.appendChild(cv); b.appendChild(lab(text)); return b; };
const rowOf = (root) => { const r = document.createElement('div'); r.className = 'row'; root.appendChild(r); return r; };
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
window.sheet = (zoom) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('Hair ' + HAIR + ' in the game (drawFigure, Sculpted figures on), zoom ' + zoom + ', no outfit: idle and walk; then the heads larger', 'h'));
  for (const gender of ['man', 'woman']) {
    const row = rowOf(root), heads = rowOf(root);
    for (const [what, moving, phase] of [['idle', false, 1.5], ['walk', true, Math.PI / 2]]) for (const facing of [0, 1, 2, 4]) {
      const cv = cell(zoom, gender, facing, moving, phase);
      row.appendChild(box(cv, gender + ' ' + what + ' ' + FACES[facing]));
      if (what === 'idle') { const h = head(cell(zoom * 2, gender, facing, false, 1.5), zoom * 2, gender); heads.appendChild(box(h, gender + ' head ' + FACES[facing])); }
    }
  }
};
window.gear = (zoom) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('Hair ' + HAIR + ' under the leather hat (pressed under it) and the plate helm (hidden), zoom ' + zoom, 'h'));
  for (const [name, o] of [['leather hat', { ...BARE, leatherHat: true }], ['plate helm', { ...BARE, plateHelm: true }]]) for (const gender of ['man', 'woman']) {
    const row = rowOf(root);
    for (const facing of [0, 1, 2, 4]) row.appendChild(box(head(cell(zoom * 2, gender, facing, false, 1.5, o), zoom * 2, gender), gender + ' ' + name + ' ' + FACES[facing]));
  }
};
window.swing = (zoom, times) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('Hair ' + HAIR + ' in the two-handed swing (the long sword), zoom ' + zoom + ': front, 3/4, side, back', 'h'));
  for (const t of times) for (const gender of ['man', 'woman']) {
    const row = rowOf(root);
    for (const facing of [0, 1, 2, 4]) row.appendChild(box(cell(zoom, gender, facing, false, 0, BARE, { working: true, job: 'attack_creature', act: { t, length: 2 }, gear: { weapon: { id: 'long_sword', material: 'iron', enchanted: false } } }, 56, 64), gender + ' t ' + t.toFixed(2) + ' ' + FACES[facing]));
  }
};
window.turn = (zoom, gender, facing) => { const root = document.getElementById('root'); root.innerHTML = ''; const r = rowOf(root); r.id = 'frame'; r.appendChild(cell(zoom, gender, facing, false, 1.5)); };
window.walk = (zoom, u) => { const root = document.getElementById('root'); root.innerHTML = ''; const r = rowOf(root); r.id = 'frame'; for (const gender of ['man', 'woman']) for (const facing of [0, 1, 2, 4]) r.appendChild(cell(zoom, gender, facing, true, u * Math.PI * 2)); };
`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const gif = (dir, file, ms) => execFileSync(PY, ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=int(sys.argv[3]), loop=0)
`, dir, file, String(ms)]);
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:13px sans-serif;color:#eee}#root{display:inline-block;padding:4px}.row{display:flex;gap:6px;align-items:flex-start}.c{display:flex;flex-direction:column}.l{padding:2px 2px 6px}.h{padding:4px 2px;font-weight:600}canvas{display:block}#frame{gap:0}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const shot = async (sel, path) => {
    const r = await p.evaluate((q) => { const e = document.querySelector(q).getBoundingClientRect(); return { x: e.x, y: e.y, width: Math.ceil(e.width), height: Math.ceil(e.height) }; }, sel);
    await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
    await p.screenshot({ path, clip: r, timeout: 180000 });
    console.log('wrote', path);
  };
  if (only.includes('sheet')) { await p.evaluate((z) => window.sheet(z), zoom); await shot('#root', join(out, `${hair}-game-z${zoom}.png`)); }
  if (only.includes('gear')) { await p.evaluate((z) => window.gear(z), zoom); await shot('#root', join(out, `${hair}-gear-z${zoom}.png`)); }
  if (only.includes('swing')) { await p.evaluate(([z, ts]) => window.swing(z, ts), [Math.min(zoom, 6), [0.1, 0.3, 0.45, 0.55, 0.7, 0.9]]); await shot('#root', join(out, `${hair}-swing.png`)); }
  if (only.includes('turn')) for (const gender of ['man', 'woman']) {
    const dir = join(out, 'frames'); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    for (let f = 0; f < 8; f++) { await p.evaluate(([z, g, fc]) => window.turn(z, g, fc), [zoom, gender, f]); await shot('#frame', join(dir, `f${f}.png`)); }
    gif(dir, join(out, `${hair}-turn-${gender}.gif`), 350); rmSync(dir, { recursive: true, force: true });
    console.log('wrote', join(out, `${hair}-turn-${gender}.gif`));
  }
  if (only.includes('walk')) {
    const dir = join(out, 'frames'); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    for (let k = 0; k < 12; k++) { await p.evaluate(([z, u]) => window.walk(z, u), [Math.min(zoom, 6), k / 12]); await shot('#frame', join(dir, `f${String(k).padStart(2, '0')}.png`)); }
    gif(dir, join(out, `${hair}-walk.gif`), 90); rmSync(dir, { recursive: true, force: true });
    console.log('wrote', join(out, `${hair}-walk.gif`));
  }
} finally {
  await browser.close();
}
