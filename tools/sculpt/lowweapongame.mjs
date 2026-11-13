// The weapons wielded on the low-poly bodies (tools/sculpt/gear/weapons.mjs, and the long sword, the maul and the hand
// tools wielded as weapons) in the game's own renderer: drawFigure with the "Sculpted figures" switch on, as the island
// draws a body (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL); each alone through lowPropDraw.
//
//   node tools/sculpt/lowweapongame.mjs --out <dir> [--what swatch,held,carry,walk,gifs] [--ids sword,club,...]
//       [--zoom 6] [--zooms 3,10] [--times 0.2,0.4,0.66,0.8 | --times-auto top] [--gif 6] [--tag stage-01]
//     swatch: <dir>/<tag>-swatch.png, each weapon alone (lowPropDraw) at one scale beside the long sword and the maul, in
//       iron, steel, copper, gold and adamantine plain and steel enchanted (the club in oak, pine, cherry and plum);
//     held: <dir>/<tag>-held-<id>-z<zoom>.png, both bodies in a fight with it (job attack_creature, act t of a go its
//       clip's length), front, 3/4, side and back at those times (the one-handed fight's: rest, top, strike, impact; the
//       swing's at its own);
//     carry: <dir>/<tag>-carry-<outfit>-z<zoom>.png, both bodies stood idle with each wielded and not in hand, front, 3/4,
//       side, back 3/4, back and the right side;
//     walk: <dir>/<tag>-walk-z<zoom>.png, both bodies walking with each carried, four moments of a stride, from the side
//       it is carried on and from behind;
//     gifs: <dir>/<tag>-swing-<id>-<man|woman>-<view>-z<gif>.gif, the fight played on the page's clock (idle, then the
//       blow, one go of the clip's length), each frame saved off the canvas.
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel; the GIFs need
// Python's PIL (PYTHON, else python3).
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowweapongame'));
const what = new Set(opt('what', 'swatch,held,carry,walk,gifs').split(','));
const tag = opt('tag', 'weapons');
const ALL = ['short_sword', 'sword', 'hunting_knife', 'butchering_knife', 'carving_knife', 'hatchet', 'battle_axe', 'club', 'spear', 'javelin', 'throwing_axe'];
const ids = opt('ids', ALL.join(',')).split(',');
const ZOOM = +opt('zoom', '6');
const zooms = opt('zooms', '3,10').split(',').map(Number).filter((z) => z > 0);
const gifZoom = +opt('gif', '6');
const PY = process.env.PYTHON ?? 'python3';
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
import { lowPropDraw } from './src/sculpt/lowpoly';
import { drawSculptGL } from './src/sculpt/gl';
import { CLIPS, clipFor } from './src/sculpt/anim';
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' });
const BG = '#7d9b5e';
const lab = (t, cls = 'l') => { const d = document.createElement('div'); d.className = cls; d.textContent = t; return d; };
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
/** A prop alone, cropped to what was drawn, on the grass; its height kept to the zoom's scale. */
function propCell(id, piece, yaw, zoom) {
  const d = lowPropDraw(id, piece, yaw), w = Math.ceil(70 * zoom), h = Math.ceil(110 * zoom);
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
window.swatch = (zoom, ids, metals, woods) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('Each weapon alone (the game renderer, lowPropDraw), zoom ' + zoom + ', one scale: ' + metals.join(', ') + ' plain, steel enchanted; the club in ' + woods.join(', ') + ' plain, oak enchanted', 'h'));
  for (const id of ids) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    row.appendChild(lab(id, 'm'));
    const mats = id === 'club' ? woods : metals;
    for (const m of mats) { const b = document.createElement('div'); b.className = 'c'; b.appendChild(propCell(id, { id, material: m }, 200, zoom)); b.appendChild(lab(m)); row.appendChild(b); }
    const b = document.createElement('div'); b.className = 'c'; b.appendChild(propCell(id, { id, material: id === 'club' ? 'oak' : 'steel', enchanted: true }, 200, zoom)); b.appendChild(lab('enchanted')); row.appendChild(b);
    const e = document.createElement('div'); e.className = 'c'; e.appendChild(propCell(id, { id, material: id === 'club' ? 'oak' : 'iron' }, 290, zoom)); e.appendChild(lab('edge on')); row.appendChild(e);
  }
};
const fightPose = (gender, facing, id, metal, lit, t, length, pid) => ({ id: pid, phase: 0, moving: false, facing, swimming: false, working: true, job: 'attack_creature', act: { t, length }, gear: { weapon: { id, material: metal, enchanted: lit } }, look: look(gender) });
window.clipLength = (id) => { const c = clipFor(fightPose('man', 0, id, 'iron', false, 0.1, 99)); return c ? c.clip.length + '|' + c.clip.name : 'none'; };
const size = (zoom) => [Math.ceil(64 * zoom), Math.ceil(84 * zoom)];
function cell(zoom, p, foot = 14) {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = BG; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - foot * zoom, zoom, p);
  return cv;
}
const VIEWS = [[0, 'front'], [1, '3/4'], [2, 'side'], [4, 'back']];
window.held = (zoom, id, metal, times, length) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab(id + ' in a fight (' + window.clipLength(id) + '), the game renderer, zoom ' + zoom + ': front, 3/4, side, back at clip times ' + times.join(', '), 'h'));
  for (const [gender, lit] of [['man', false], ['woman', true]]) for (const t of times) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (const [facing, v] of VIEWS) { const b = document.createElement('div'); b.className = 'c'; b.appendChild(cell(zoom, fightPose(gender, facing, id, metal, lit, t, length))); b.appendChild(lab(gender + ' ' + metal + (lit ? ' lit' : '') + ' t ' + t + ' ' + v)); row.appendChild(b); }
  }
};
window.carry = (zoom, outfit, sets, moving, phases) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab((moving ? 'Walking' : 'Stood idle') + ' with each wielded and not in hand, outfit ' + outfit.name + ', the game renderer, zoom ' + zoom, 'h'));
  const views = moving ? [[6, 'left side'], [2, 'right side'], [4, 'back']] : [[0, 'front'], [1, '3/4'], [2, 'side'], [3, 'back 3/4'], [4, 'back'], [6, 'side r']];
  for (const gender of ['man', 'woman']) for (const [id, metal, lit] of sets) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (const ph of phases) for (const [facing, v] of views) {
      const p = { phase: ph, moving, facing, swimming: false, working: false, gear: { weapon: { id, material: metal, enchanted: lit } }, outfit: outfit.on, look: look(gender) };
      const b = document.createElement('div'); b.className = 'c'; b.appendChild(cell(zoom, p)); b.appendChild(lab(gender + ' ' + id + ' ' + v + (moving ? ' ph ' + ph.toFixed(1) : ''))); row.appendChild(b);
    }
  }
};
window.play = (zoom, gender, facing, id, metal, lit, secs, go) => {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'), pid = 'wpn-' + gender + '-' + facing + '-' + Math.random(), frames = [], IDLE = 0.3, DT = 0.04;
  const real = performance.now.bind(performance), t0 = real();
  let clock = t0;
  performance.now = () => clock;
  try {
    for (let el = 0; el < IDLE + secs; el += DT) {
      clock = t0 + el * 1000;
      const t = el - IDLE, p = t < 0 ? { ...fightPose(gender, facing, id, metal, lit, 0, go, pid), working: false, job: undefined, act: undefined } : fightPose(gender, facing, id, metal, lit, t % go, go, pid);
      g.fillStyle = BG; g.fillRect(0, 0, cw, ch);
      drawFigure(g, cw / 2, ch - 14 * zoom, zoom, p);
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(gender + ' ' + id + ' ' + metal + (lit ? ' (enchanted) ' : ' ') + ['front', '3/4', 'side', 'back 3/4', 'back'][facing] + (t < 0 ? '  idle' : '  t ' + (t % go).toFixed(2) + 's'), 6, 14);
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
  p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:13px sans-serif;color:#eee}#root{display:inline-block;padding:4px;width:max-content}.row{display:flex;gap:6px;align-items:flex-end}.c{display:flex;flex-direction:column;flex-shrink:0}.l{padding:2px 2px 6px}.m{width:110px;padding:4px;align-self:center}.h{padding:4px 2px;font-weight:600}canvas{display:block;align-self:center;flex:none}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const shot = async (path) => {
    const r = await p.evaluate(() => { const bb = document.querySelector('#root').getBoundingClientRect(); return { x: bb.x, y: bb.y, width: Math.ceil(bb.width), height: Math.ceil(bb.height) }; });
    await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
    await p.screenshot({ path, clip: r, timeout: 600000 });
    console.log('wrote', path, `${r.width}x${r.height}`);
  };
  const lengths = {};
  for (const id of ids) { const [len, name] = (await p.evaluate((i) => window.clipLength(i), id)).split('|'); lengths[id] = { len: +len, name }; }
  console.log('clips', JSON.stringify(lengths));
  if (what.has('swatch')) {
    await p.evaluate(([z, ii, mm, ww]) => window.swatch(z, ii, mm, ww), [ZOOM, [...ids, 'long_sword', 'maul'], opt('metals', 'iron,steel,copper,gold,adamantine').split(','), ['oak', 'pine', 'cherry', 'plum', 'birch']]);
    await shot(join(out, `${tag}-swatch.png`));
  }
  const METAL = { short_sword: 'steel', sword: 'iron', hunting_knife: 'copper', butchering_knife: 'iron', carving_knife: 'steel', hatchet: 'copper', battle_axe: 'adamantine', club: 'oak', spear: 'iron', javelin: 'gold', throwing_axe: 'steel' };
  if (what.has('held')) for (const id of ids) for (const z of zooms) {
    const { len, name } = lengths[id];
    const two = opt('times-auto', '') === 'top', times = opt('times', '') ? opt('times', '').split(',').map(Number) : name === 'swing' ? (two ? [1.34, 1.62] : [0.84, 1.34, 1.62, 1.7]) : two ? [0.38, 0.74] : [0.1, 0.38, 0.66, 0.8];
    await p.evaluate(([zz, ii, mm, tt, ll]) => window.held(zz, ii, mm, tt, ll), [z, id, METAL[id] ?? 'iron', times, len]);
    await shot(join(out, `${tag}-held-${id}-z${z}.png`));
  }
  const OUTFITS = [
    { name: 'cloth', on: {} },
    { name: 'plate', on: { plateChest: true, plateLegs: true, plateBoots: true, plateHelm: true, plateMantle: true } },
    { name: 'leather', on: { leatherChest: true, leatherLegs: true, leatherBoots: true, leatherHat: true, leatherShawl: true } },
  ];
  const sets = ids.map((id) => [id, METAL[id] ?? 'iron', false]);
  if (what.has('carry')) for (const o of OUTFITS.filter((x) => opt('outfits', 'cloth,plate,leather').split(',').includes(x.name))) for (const z of zooms) {
    await p.evaluate(([zz, oo, ss]) => window.carry(zz, oo, ss, false, [0]), [z, o, sets]);
    await shot(join(out, `${tag}-carry-${o.name}-z${z}.png`));
  }
  if (what.has('walk')) for (const o of OUTFITS.filter((x) => opt('walkoutfits', 'cloth').split(',').includes(x.name))) {
    await p.evaluate(([zz, oo, ss]) => window.carry(zz, oo, ss, true, [0, 1.6, 3.2, 4.7]), [+opt('walkzoom', '4'), o, sets]);
    await shot(join(out, `${tag}-walk-${o.name}.png`));
  }
  if (what.has('gifs') && gifZoom > 0) for (const id of ids) {
    const go = lengths[id].len;
    for (const [gender, facing, lit] of [['man', 1, false], ['woman', 2, true]]) {
      const frames = await p.evaluate(([zz, gg, ff, ii, mm, ll, ss, gg2]) => window.play(zz, gg, ff, ii, mm, ll, ss, gg2), [gifZoom, gender, facing, id, METAL[id] ?? 'iron', lit, go * 1.25, go]);
      const v = ['front', '34', 'side', 'rq3', 'back'][facing];
      const dir = join(out, `.frames-${id}-${gender}-${v}`); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
      frames.forEach((f, i) => writeFileSync(join(dir, `f${String(i).padStart(4, '0')}-${Math.round(f.at * 1000)}.png`), Buffer.from(f.url.split(',')[1], 'base64')));
      const gif = join(out, `${tag}-swing-${id}-${gender}-${v}-z${gifZoom}.gif`);
      execFileSync(PY, ['-c', `
import sys, glob, os
from PIL import Image
fs = sorted(glob.glob(sys.argv[1] + '/f*.png'))
at = [int(os.path.basename(f).split('-')[1][:-4]) for f in fs]
fr = [Image.open(f).convert('RGB').quantize(colors=255, method=Image.Quantize.MEDIANCUT) for f in fs]
du = [max(20, at[i + 1] - at[i]) for i in range(len(at) - 1)] + [60]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=du, loop=0)
print('wrote', sys.argv[2], len(fr), 'frames')
`, dir, gif], { stdio: 'inherit' });
      rmSync(dir, { recursive: true, force: true });
    }
  }
} finally {
  await browser.close();
}
