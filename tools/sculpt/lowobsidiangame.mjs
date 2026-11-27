// Obsidian on the low-poly bodies in the game's own renderer (drawFigure with the "Sculpted figures" switch on, as the
// island draws a body; a prop alone through lowPropDraw): the knapped tools and weapons (tools/sculpt/gear/obsidian.mjs)
// and the obsidian set (tools/sculpt/garments/obsidian*.mjs).
//
//   node tools/sculpt/lowobsidiangame.mjs --out <dir> [--what lineup,weapons,tools,set,pieces] [--zoom 5] [--tag obsidian]
//     lineup: <dir>/<tag>-lineup.png, every knapped item alone: in iron, in Obsidian, Obsidian edge on, Obsidian enchanted;
//     weapons: <dir>/<tag>-weapons-<id>.png, both bodies in a fight with it, 3/4 and side, two moments of the blow;
//     tools: <dir>/<tag>-tools-<id>.png, both bodies at a job done with it, 3/4 and side, two moments;
//     set: <dir>/<tag>-set.png, both bodies in the whole set, front, 3/4, side, back 3/4 and back, plain and enchanted;
//     pieces: <dir>/<tag>-pieces.png, each piece worn alone over the first outfit, front and back, and over the other
//       sets' pieces (the cuirass over plate legs, the shawl over a hauberk, ...).
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, `--dpr` device pixels a CSS pixel (default 2).
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { addScript } from '../pagescript.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowobsidiangame'));
const what = new Set(opt('what', 'lineup,weapons,tools,set,pieces').split(','));
const tag = opt('tag', 'obsidian');
const ZOOM = +opt('zoom', '5');
const DPR = +opt('dpr', '2');
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
import { lowPropDraw } from './src/sculpt/lowpoly';
import { drawSculptGL } from './src/sculpt/gl';
import { clipFor } from './src/sculpt/anim';
import { ACTIONS } from './src/game/actions';
import { KNAPPED } from './src/game/recipes';
import { isWeapon } from './src/game/gear';
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' });
const BG = '#7d9b5e';
const lab = (t, cls = 'l') => { const d = document.createElement('div'); d.className = cls; d.textContent = t; return d; };
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
window.knapped = () => Object.keys(KNAPPED);
window.isWeapon = (id) => isWeapon(id);
function propCell(id, piece, yaw, zoom) {
  const d = lowPropDraw(id === 'pickaxe' ? 'pickaxe' : id, piece, yaw), w = Math.ceil(70 * zoom), h = Math.ceil(110 * zoom);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  if (d) drawSculptGL(g, w / 2, h - 30 * zoom, zoom, d, { dpr: 1 });
  const px = g.getImageData(0, 0, w, h).data;
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < x0) { x0 = 0; y0 = 0; x1 = 10; y1 = 10; }
  const o = document.createElement('canvas'), pad = 6; o.width = x1 - x0 + 1 + pad * 2; o.height = y1 - y0 + 1 + pad * 2;
  const og = o.getContext('2d'); og.fillStyle = BG; og.fillRect(0, 0, o.width, o.height);
  og.drawImage(cv, x0, y0, x1 - x0 + 1, y1 - y0 + 1, pad, pad, x1 - x0 + 1, y1 - y0 + 1);
  return o;
}
window.lineup = (zoom, ids) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('Knapped obsidian, each alone (the game renderer, lowPropDraw), zoom ' + zoom + ': iron, Obsidian, Obsidian edge on, Obsidian enchanted', 'h'));
  for (const id of ids) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    row.appendChild(lab(id, 'm'));
    for (const [m, yaw, lit, t] of [['iron', 200, false, 'iron'], ['Obsidian', 200, false, 'obsidian'], ['Obsidian', 290, false, 'obsidian, edge on'], ['Obsidian', 200, true, 'obsidian, enchanted']]) {
      const b = document.createElement('div'); b.className = 'c'; b.appendChild(propCell(id, { id, material: m, enchanted: lit }, yaw, zoom)); b.appendChild(lab(t)); row.appendChild(b);
    }
  }
};
const size = (zoom) => [Math.ceil(40 * zoom), Math.ceil(64 * zoom)];
function cell(zoom, p, foot = 14) {
  const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = BG; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - foot * zoom, zoom, p);
  return cv;
}
const fightPose = (gender, facing, id, t, length) => ({ phase: 0, moving: false, facing, swimming: false, working: true, job: 'attack_creature', act: { t, length }, gear: { weapon: { id, material: 'Obsidian' } }, look: look(gender) });
const jobOf = (id) => (ACTIONS.find((a) => a.tool === id && !a.instant) ?? ACTIONS.find((a) => a.tool === id))?.id;
const workPose = (gender, facing, id, t, length) => ({ phase: 0, moving: false, facing, swimming: false, working: true, job: jobOf(id), act: { t, length }, tool: { id, material: 'Obsidian' }, look: look(gender) });
window.lengthOf = (id, kind) => { const p = kind === 'weapon' ? fightPose('man', 0, id, 0.1, 99) : workPose('man', 0, id, 0.1, 99); const c = clipFor(p); return c ? c.clip.length : 1; };
window.jobOf = jobOf;
window.held = (zoom, id, kind, times, length) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab((kind === 'weapon' ? 'Obsidian ' + id + ' in a fight' : 'Obsidian ' + id + ' at ' + jobOf(id)) + ', the game renderer, zoom ' + zoom, 'h'));
  for (const gender of ['man', 'woman']) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (const t of times) for (const [facing, v] of [[1, '3/4'], [2, 'side']]) {
      const p = kind === 'weapon' ? fightPose(gender, facing, id, t, length) : workPose(gender, facing, id, t, length);
      const b = document.createElement('div'); b.className = 'c'; b.appendChild(cell(zoom, p)); b.appendChild(lab(gender + ' t ' + t.toFixed(2) + ' ' + v)); row.appendChild(b);
    }
  }
};
const SET = ['obsidian_helm', 'obsidian_cuirass', 'obsidian_shawl', 'obsidian_leggings', 'obsidian_boots'];
const SLOT = { obsidian_helm: 'head', obsidian_cuirass: 'chest', obsidian_shawl: 'shawl', obsidian_leggings: 'legs', obsidian_boots: 'feet' };
const gearOf = (ids, lit, extra = {}) => ({ ...Object.fromEntries(ids.map((id) => [SLOT[id] ?? id.split(':')[0], { id: id.includes(':') ? id.split(':')[1] : id, ...(lit ? { enchanted: true } : {}) }])), ...extra });
const stood = (gender, facing, gear) => ({ phase: 0, moving: false, facing, swimming: false, working: false, gear, look: look(gender) });
window.set = (zoom) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('The obsidian set, both bodies, the game renderer, zoom ' + zoom + ': front, 3/4, side, back 3/4, back; plain and enchanted; with an obsidian sword', 'h'));
  for (const gender of ['man', 'woman']) for (const lit of [false, true]) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (const [facing, v] of [[0, 'front'], [1, '3/4'], [2, 'side'], [3, 'back 3/4'], [4, 'back']]) {
      const b = document.createElement('div'); b.className = 'c'; b.appendChild(cell(zoom, stood(gender, facing, gearOf(SET, lit, { weapon: { id: 'sword', material: 'Obsidian' } })))); b.appendChild(lab(gender + (lit ? ' enchanted ' : ' ') + v)); row.appendChild(b);
    }
  }
};
window.pieces = (zoom) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('Each obsidian piece alone, and over the other sets, the game renderer, zoom ' + zoom + ': front and back', 'h'));
  const combos = [
    ...SET.map((id) => [id.replace('obsidian_', ''), [id]]),
    ['cuirass over plate legs', ['obsidian_cuirass', 'legs:plate_legs', 'feet:plate_boots']],
    ['cuirass over leather legs', ['obsidian_cuirass', 'legs:leather_trousers']],
    ['leggings under a breastplate', ['chest:plate_breastplate', 'obsidian_leggings', 'obsidian_boots']],
    ['shawl over a hauberk', ['chest:chain_hauberk', 'obsidian_shawl']],
    ['cloth shawl over the cuirass', ['obsidian_cuirass', 'shawl:cloth_shawl']],
    ['helm, coif chest', ['obsidian_helm', 'chest:chain_hauberk', 'legs:chain_leggings']],
  ];
  for (const [name, ids] of combos) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    row.appendChild(lab(name, 'm'));
    for (const gender of ['man', 'woman']) for (const [facing, v] of [[0, 'front'], [1, '3/4'], [4, 'back']]) {
      const b = document.createElement('div'); b.className = 'c'; b.appendChild(cell(zoom, stood(gender, facing, gearOf(ids, false)))); b.appendChild(lab(gender + ' ' + v)); row.appendChild(b);
    }
  }
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: DPR });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:13px sans-serif;color:#eee}#root{display:inline-block;padding:4px;width:max-content}.row{display:flex;gap:6px;align-items:flex-end}.c{display:flex;flex-direction:column;flex-shrink:0}.l{padding:2px 2px 6px}.m{width:110px;padding:4px;align-self:center}.h{padding:4px 2px;font-weight:600}canvas{display:block;align-self:center;flex:none}</style></head><body><div id=root></div></body></html>');
  await addScript(p, b.outputFiles[0].text);
  await p.evaluate(() => window.ready());
  const shot = async (path) => {
    const r = await p.evaluate(() => { const bb = document.querySelector('#root').getBoundingClientRect(); return { x: bb.x, y: bb.y, width: Math.ceil(bb.width), height: Math.ceil(bb.height) }; });
    await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
    await p.screenshot({ path, clip: r, timeout: 600000 });
    console.log('wrote', path, `${r.width}x${r.height}`);
  };
  const ids = (opt('ids', '') || (await p.evaluate(() => window.knapped().join(',')))).split(',');
  if (what.has('lineup')) {
    await p.evaluate(([z, ii]) => window.lineup(z, ii), [ZOOM, ids]);
    await shot(join(out, `${tag}-lineup.png`));
  }
  for (const id of ids) {
    const weapon = await p.evaluate((i) => window.isWeapon(i), id);
    const kind = weapon ? 'weapon' : 'tool';
    if (!what.has(weapon ? 'weapons' : 'tools')) continue;
    const len = await p.evaluate(([i, k]) => window.lengthOf(i, k), [id, kind]);
    await p.evaluate(([zz, ii, kk, tt, ll]) => window.held(zz, ii, kk, tt, ll), [+opt('heldzoom', '4'), id, kind, [len * 0.38, len * 0.66], len]);
    await shot(join(out, `${tag}-${weapon ? 'weapons' : 'tools'}-${id}.png`));
  }
  if (what.has('set')) { await p.evaluate((z) => window.set(z), +opt('setzoom', '4')); await shot(join(out, `${tag}-set.png`)); }
  if (what.has('pieces')) { await p.evaluate((z) => window.pieces(z), +opt('setzoom', '4')); await shot(join(out, `${tag}-pieces.png`)); }
} finally {
  await browser.close();
}
