// The long sword's blade, the maul's (the Runestone Warhammer's) head and the pickaxe's (the Runestone Pickaxe's) head in
// the metal they were smithed from (src/sculpt/lowpoly.ts metalTint, the flat figure's metalShades), in the game's own
// renderer (drawSculptGL; drawFigure with the "Sculpted figures" switch on, as the island draws a body).
//
//   node tools/sculpt/lowmetalgame.mjs --out <dir> [--what swatch,stills,gifs,back] [--zoom 9] [--zooms 2,3,8] [--gif 8]
//     swatch: <dir>/metals-swatch.png, each prop alone (lowPropDraw) in every metal and in none, plain and enchanted;
//     stills: <dir>/metals-game-z<zoom>.png, both bodies holding each in three metals, front, 3/4, side and back, at the
//       swing's blow (a fight with the long sword or the maul, mining with the pickaxe: the pose's tool);
//     gifs: <dir>/metals-<prop>-<metal>-<man|woman>-<view>-z<gif>.gif, the swing played on the page's clock (the body's id
//       kept, so the animator fades as the game's does; idle, then the blow), each frame saved off the canvas (toDataURL);
//     back: <dir>/metals-back-<outfit>.png, the maul and the long sword wielded and carried on the back, each outfit, both
//       bodies, front, 3/4, side and back.
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
const out = resolve(opt('out', 'tmp/lowmetalgame'));
const what = new Set(opt('what', 'swatch,stills,gifs,back').split(','));
const ZOOM = +opt('zoom', '9');
const zooms = opt('zooms', '2,3,8').split(',').map(Number).filter((z) => z > 0);
const gifZoom = +opt('gif', '8');
const PY = process.env.PYTHON ?? 'python3';
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
import { METALS } from './src/game/metal';
import { lowPropDraw } from './src/sculpt/lowpoly';
import { drawSculptGL } from './src/sculpt/gl';
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' });
const PROPS = [['long_sword', 'Long sword'], ['maul', 'Maul'], ['pickaxe', 'Pickaxe']];
const VIEWS = [[0, 'front'], [1, '3/4'], [2, 'side'], [4, 'back']];
const BG = '#7d9b5e';
const lab = (t, cls = 'l') => { const d = document.createElement('div'); d.className = cls; d.textContent = t; return d; };
window.METALS = METALS.map((m) => m.id);
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
/** A prop alone at a zoom, cropped to what was drawn, on the grass. */
function propCell(id, piece, yaw, zoom) {
  const d = lowPropDraw(id, piece, yaw), w = Math.ceil(100 * zoom), h = Math.ceil(110 * zoom);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  drawSculptGL(g, w / 2, h - 30 * zoom, zoom, d, { dpr: 1 });
  const px = g.getImageData(0, 0, w, h).data;
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const o = document.createElement('canvas'), pad = 6; o.width = x1 - x0 + 1 + pad * 2; o.height = y1 - y0 + 1 + pad * 2;
  const og = o.getContext('2d'); og.fillStyle = BG; og.fillRect(0, 0, o.width, o.height);
  og.drawImage(cv, x0, y0, x1 - x0 + 1, y1 - y0 + 1, pad, pad, x1 - x0 + 1, y1 - y0 + 1);
  return o;
}
window.swatch = (zoom) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('Blade and heads in each metal (the game renderer, lowPropDraw), zoom ' + zoom + ': plain, enchanted; the last row no metal (the fallback)', 'h'));
  const head = document.createElement('div'); head.className = 'row'; root.appendChild(head);
  head.appendChild(lab('', 'm'));
  for (const [, name] of PROPS) for (const lit of [false, true]) head.appendChild(lab(name + (lit ? ' enchanted' : ' plain'), 'ch'));
  for (const metal of [...window.METALS, undefined]) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    row.appendChild(lab(metal ?? 'none', 'm'));
    for (const [id] of PROPS) for (const lit of [false, true]) {
      const box = document.createElement('div'); box.className = 'c';
      box.appendChild(propCell(id, { id, material: metal, enchanted: lit }, id === 'long_sword' ? 200 : 160, zoom));
      row.appendChild(box);
    }
  }
};
/** The pose: a fight with the weapon, or mining with the pickaxe, at clip time t of a go of length. */
const pose = (gender, facing, prop, metal, lit, t, length, id) => {
  const piece = { id: prop, material: metal, enchanted: lit };
  const mine = prop === 'pickaxe';
  return { id, phase: 0, moving: false, facing, swimming: false, working: true, job: mine ? 'mine' : 'attack_creature', act: { t, length }, gear: mine ? {} : { weapon: piece }, ...(mine ? { tool: piece } : {}), look: look(gender) };
};
const size = (zoom) => [Math.ceil(56 * zoom), Math.ceil(80 * zoom)];
function cell(zoom, p) {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = BG; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 12 * zoom, zoom, p);
  return cv;
}
window.stills = (zoom, sets, t) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('Held in the swing (t ' + t + ' s of a 2 s go), the game renderer, zoom ' + zoom + ': front, 3/4, side, back', 'h'));
  for (const gender of ['man', 'woman']) for (const [prop, metal, lit] of sets) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (const [facing, v] of VIEWS) { const box = document.createElement('div'); box.className = 'c'; box.appendChild(cell(zoom, pose(gender, facing, prop, metal, lit, t, 2))); box.appendChild(lab(gender + ' ' + prop + ' ' + metal + (lit ? ' lit' : '') + ' ' + v)); row.appendChild(box); }
  }
};
/** Wielded, not in hand: stood idle, the weapon on the back (where it has a back socket), in an outfit. */
window.backs = (zoom, outfit, sets) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('Carried on the back, outfit ' + outfit.name + ', the game renderer, zoom ' + zoom + ': front, 3/4, side, back', 'h'));
  for (const gender of ['man', 'woman']) for (const [prop, metal, lit] of sets) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (const [facing, v] of [[0, 'front'], [1, '3/4'], [2, 'side'], [3, 'back 3/4'], [4, 'back'], [6, 'side r']]) {
      const p = { phase: 0, moving: false, facing, swimming: false, working: false, gear: { weapon: { id: prop, material: metal, enchanted: lit } }, outfit: outfit.on, look: look(gender) };
      const box = document.createElement('div'); box.className = 'c'; box.appendChild(cell(zoom, p)); box.appendChild(lab(gender + ' ' + prop + ' ' + metal + ' ' + v)); row.appendChild(box);
    }
  }
};
// one body and one view played on the page's clock: the clock (performance.now, which the figure and the animator's
// fades read) put forward 40 ms a frame, so every frame is drawn at its own moment however long the software renderer
// takes over it; stood idle for its first 0.3 s, then the blow (a go of SECS), faded into as the game fades it
window.play = (zoom, gender, facing, prop, metal, lit, secs, go) => {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'), id = 'met-' + gender + '-' + facing + '-' + Math.random(), frames = [], IDLE = 0.3, DT = 0.04;
  const real = performance.now.bind(performance), t0 = real();
  let clock = t0;
  performance.now = () => clock;
  try {
    for (let el = 0; el < IDLE + secs; el += DT) {
      clock = t0 + el * 1000;
      const t = el - IDLE, p = t < 0 ? { ...pose(gender, facing, prop, metal, lit, 0, go, id), working: false, job: undefined, act: undefined } : pose(gender, facing, prop, metal, lit, t % go, go, id);
      g.fillStyle = BG; g.fillRect(0, 0, cw, ch);
      drawFigure(g, cw / 2, ch - 12 * zoom, zoom, p);
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(gender + ' ' + prop + ' ' + metal + (lit ? ' (enchanted) ' : ' ') + ['front', '3/4', 'side', '', 'back'][facing] + (t < 0 ? '  idle' : '  t ' + (t % go).toFixed(2) + 's'), 6, 14);
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
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:13px sans-serif;color:#eee}#root{display:inline-block;padding:4px}.row{display:flex;gap:6px;align-items:flex-end}.c{display:flex;flex-direction:column}.l{padding:2px 2px 6px}.m{width:90px;padding:4px;align-self:center}.ch{width:auto;min-width:60px;padding:2px}.h{padding:4px 2px;font-weight:600}canvas{display:block}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const shot = async (path) => {
    const r = await p.evaluate(() => { const bb = document.querySelector('#root').getBoundingClientRect(); return { x: bb.x, y: bb.y, width: Math.ceil(bb.width), height: Math.ceil(bb.height) }; });
    await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
    await p.screenshot({ path, clip: r, timeout: 300000 });
    console.log('wrote', path, `${r.width}x${r.height}`);
  };
  if (what.has('swatch')) {
    await p.evaluate((z) => window.swatch(z), ZOOM);
    await shot(join(out, 'metals-swatch.png'));
  }
  const SETS = [['long_sword', 'copper', false], ['long_sword', 'steel', false], ['long_sword', 'gold', true],
    ['maul', 'iron', false], ['maul', 'bronze', false], ['maul', 'silver', true],
    ['pickaxe', 'copper', false], ['pickaxe', 'adamantine', false], ['pickaxe', 'seryll', true]];
  if (what.has('stills')) for (const z of zooms) {
    await p.evaluate(([zz, ss]) => window.stills(zz, ss, 1.62), [z, SETS]);
    await shot(join(out, `metals-game-z${z}.png`));
  }
  if (what.has('back')) {
    const OUTFITS = [
      { name: 'cloth', on: {} },
      { name: 'cloth-hood', on: { hood: true } },
      { name: 'plate', on: { plateChest: true, plateLegs: true, plateBoots: true, plateHelm: true, plateMantle: true } },
      { name: 'leather', on: { leatherChest: true, leatherLegs: true, leatherBoots: true, leatherHat: true, leatherShawl: true } },
    ];
    const only = opt('outfits', '').split(',').filter(Boolean);
    for (const o of OUTFITS.filter((x) => !only.length || only.includes(x.name))) {
      await p.evaluate(([zz, oo, ss]) => window.backs(zz, oo, ss), [+opt('backzoom', '4'), o, opt('backsets', 'maul:iron:0,maul:copper:1,long_sword:steel:0').split(',').map((x) => x.split(':')).map(([pp, mm, ll]) => [pp, mm, ll === '1'])]);
      await shot(join(out, `metals-back-${o.name}.png`));
    }
  }
  if (what.has('gifs') && gifZoom > 0) {
    const GO = { long_sword: 2.9, maul: 3.4, pickaxe: 2.4 };
    const PLAYS = (opt('plays', '') || 'maul:iron:man:0:0,maul:copper:woman:2:1,maul:silver:man:1:0,long_sword:steel:man:1:0,long_sword:gold:woman:0:1,long_sword:copper:woman:2:0,pickaxe:copper:man:1:0,pickaxe:mithril:woman:2:0,pickaxe:gold:woman:1:1').split(',').map((s) => s.split(':'));
    for (const [prop, metal, gender, facing, lit] of PLAYS) {
      const frames = await p.evaluate(([zz, gg, ff, pp, mm, ll, ss, go]) => window.play(zz, gg, ff, pp, mm, ll, ss, go), [gifZoom, gender, +facing, prop, metal, lit === '1', GO[prop] * 1.25, GO[prop]]);
      const v = ['front', '34', 'side', '', 'back'][+facing];
      const dir = join(out, `.frames-${prop}-${metal}-${gender}-${v}`); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
      frames.forEach((f, i) => writeFileSync(join(dir, `f${String(i).padStart(4, '0')}-${Math.round(f.at * 1000)}.png`), Buffer.from(f.url.split(',')[1], 'base64')));
      const gif = join(out, `metals-${prop}-${metal}-${gender}-${v}-z${gifZoom}.gif`);
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
      rmSync(dir, { recursive: true, force: true });
    }
  }
} finally {
  await browser.close();
}
