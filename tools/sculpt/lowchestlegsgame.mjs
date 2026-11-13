// Every chest piece over every legs piece on both low-poly bodies in the game's own renderer: drawFigure with the
// "Sculpted figures" switch on, as the island draws a body (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL),
// each body dressed from what it has equipped (`FigurePose.gear`, through src/sculpt/lowpoly.ts outfitOf). For where the
// legs piece shows through the chest piece (src/sculpt/assets/lowchestlegs-<who>.json: the legs' polygons left out
// under each chest).
//
//   node tools/sculpt/lowchestlegsgame.mjs --out <dir> --sheet matrix|clips [--file <png>] [--gender man|woman]
//       [--chests none,tunic,jerkin,breastplate,hauberk,cuirass] [--legs cloth,leather,plate,chain,scale,bare] [--zoom 10]
//       [--views 1,2,4] [--clips walk-a,walk-b,fight,swing-up,swing-blow,kneel,seated,hop-a,hop-b] [--full] [--keep] [--title <text>]
//     sheets:
//       matrix: a row per chest, a cell per legs piece and view (3/4 front, side, back), cropped to the hips (--full: the
//         whole figure), one body (--gender);
//       clips: a row per chest × legs pair and body, a cell per clip frame (the walk's two strides, the one-handed fight's
//         blow, the overhead swing raised and at the blow, kneeling at the ground, sat at the reins, the hop's crouch and
//         its air), from each of --views.
//     --keep: every legs triangle drawn under every chest (as before src/sculpt/assets/lowchestlegs-<who>.json).
//     (chest none: the tunic off; legs bare: the trousers off.) The chest's metal steel, the legs' gold (plate) or adamantine (mail), so either shows against the other.
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowchestlegsgame'));
const sheet = opt('sheet', 'matrix'), zoom = +opt('zoom', '10');
const file = resolve(opt('file', join(out, `chestlegs-${sheet}.png`)));
mkdirSync(dirname(file), { recursive: true });
const cfg = {
  gender: opt('gender', ''), full: args.includes('--full'), title: opt('title', ''),
  chests: opt('chests', 'none,tunic,jerkin,breastplate,hauberk,cuirass').split(','),
  legs: opt('legs', 'cloth,leather,plate,chain,scale').split(','),
  pairs: opt('pairs', '').split(',').filter(Boolean).map((p) => p.split(':')),
  views: opt('views', sheet === 'clips' ? '1,3' : '1,2,4').split(',').map(Number),
  clips: opt('clips', 'walk-a,walk-b,fight,swing-up,swing-blow,kneel,seated,hop-a,hop-b').split(','),
};
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { driverOn, headingView } from './src/render/furniture';
import { DEFAULT_LOOK } from './src/game/look';
import { outfitOf } from './src/sculpt/lowpoly';
const C = ${JSON.stringify(cfg)};
const BG = '#7d9b5e';
const CHESTS = {
  none: null, tunic: { id: 'cloth_tunic' }, jerkin: { id: 'leather_jerkin' }, breastplate: { id: 'plate_breastplate', material: 'steel' },
  hauberk: { id: 'chain_hauberk', material: 'steel' }, cuirass: { id: 'scale_cuirass' },
};
const LEGS = { cloth: { id: 'cloth_trousers' }, leather: { id: 'leather_trousers' }, plate: { id: 'plate_legs', material: 'gold' }, chain: { id: 'chain_leggings', material: 'adamantine' }, scale: { id: 'scale_leggings' } };
/** What is worn for a chest and legs pair: the gear, and with no chest piece the outfit with the tunic off. */
const dress = (chest, legs, weapon) => {
  const gear = { ...(LEGS[legs] ? { legs: LEGS[legs] } : {}), ...(CHESTS[chest] ? { chest: CHESTS[chest] } : {}), ...(weapon ? { weapon } : {}) };
  // (no legs piece, 'bare': the trousers off too)
  return chest === 'none' || legs === 'bare' ? { gear, outfit: { ...outfitOf(gear), ...(chest === 'none' ? { tunic: false } : {}), ...(legs === 'bare' ? { trousers: false } : {}) } } : { gear };
};
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: gender === 'woman' ? 'braid' : 'swept', beard: 'none' });
const lab = (t, cls = 'l') => { const d = document.createElement('div'); d.className = cls; d.textContent = t; return d; };
const size = (z) => [Math.ceil(40 * z) + 24, Math.ceil(50 * z) + 24];
/** One figure: { gender, facing, zoom, phase, moving, gear, outfit, working, job, act, tool, emote, emoteT, seat, crop }. */
function cell(c) {
  const z = c.zoom, [cw, ch] = size(z), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = BG; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 3 * z - 8 - (c.lift ?? 0) * z, z, { phase: c.phase ?? 1.5, moving: !!c.moving, facing: c.facing, swimming: false, working: !!c.working, look: look(c.gender), gear: c.gear,
    ...(c.job ? { job: c.job } : {}), ...(c.act ? { act: c.act } : {}), ...(c.tool ? { tool: c.tool } : {}), ...(c.outfit ? { outfit: c.outfit } : {}),
    ...(c.emote ? { emote: c.emote, emoteT: c.emoteT } : {}), ...(c.seat ? { driving: true, seat: c.seat } : {}) });
  if (!c.crop) return cv;
  // (c.crop: [x0, y0, x1, y1], shares of the cell kept)
  const [x0, y0, x1, y1] = c.crop.map((f, k) => Math.round(f * (k % 2 ? ch : cw))), o = document.createElement('canvas');
  o.width = x1 - x0; o.height = y1 - y0; o.getContext('2d').drawImage(cv, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
function rows(title, list) {
  const root = document.getElementById('root'); root.innerHTML = '';
  if (C.title !== '-') root.appendChild(lab(C.title || title, 'h'));
  for (const [name, cells] of list) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    row.appendChild(lab(name, 'm'));
    for (const c of cells) { const box = document.createElement('div'); box.className = 'c'; box.appendChild(cell(c)); if (c.label) box.appendChild(lab(c.label)); row.appendChild(box); }
  }
}
const VIEW = { 0: 'front', 1: '3/4', 2: 'side', 3: 'rear 3/4', 4: 'back', 5: 'rear 3/4 l', 6: 'left', 7: '3/4 l' };
/** The hips and thighs of a stood figure (shares of the cell). */
const HIPS = { man: [0.27, 0.38, 0.73, 0.85], woman: [0.27, 0.45, 0.73, 0.88] };
const seat = () => driverOn('large_cart', headingView(0, 0)).seat;
/** Each clip frame's cell cropped to the body (shares of the cell): knelt, low and forward; sat, raised; in the air, higher. */
const CROP = { kneel: [0.36, 0.42, 1, 1], seated: [0.18, 0.2, 0.82, 0.84], 'hop-b': [0.18, 0.14, 0.82, 0.8] };
/** The clip frames: each the pose's own switches over the gear. */
const CLIP = {
  'walk-a': () => ({ moving: true, phase: 0.4 }),
  'walk-b': () => ({ moving: true, phase: 2.0 }),
  fight: () => ({ working: true, job: 'attack_creature', act: { t: 0.62, length: 2 }, weapon: { id: 'sword', material: 'iron' } }),
  'swing-up': () => ({ working: true, job: 'attack_creature', act: { t: 0.7, length: 2 }, weapon: { id: 'maul', material: 'iron' } }),
  'swing-blow': () => ({ working: true, job: 'attack_creature', act: { t: 1.15, length: 2 }, weapon: { id: 'maul', material: 'iron' } }),
  kneel: () => ({ working: true, job: 'plant', act: { t: 1.2, length: 3 } }),
  seated: () => ({ seat: seat(), phase: 3, lift: 4 }),
  'hop-a': () => ({ emote: 'hop', emoteT: 0.12 }),
  'hop-b': () => ({ emote: 'hop', emoteT: 0.3 }),
};
window.sheets = {
  matrix: (zoom) => {
    const genders = C.gender ? [C.gender] : ['man', 'woman'], L = [];
    for (const gender of genders) for (const chest of C.chests) L.push([gender + ' ' + chest, C.legs.flatMap((legs) => C.views.map((f) => ({ gender, facing: f, zoom, ...dress(chest, legs), crop: C.full ? undefined : HIPS[gender], label: legs + ' ' + VIEW[f] })))]);
    rows('Chest (rows) over legs (cells), the game renderer, zoom ' + zoom + ' (legs: plate gold, chain adamantine; chest steel)', L);
  },
  clips: (zoom) => {
    const genders = C.gender ? [C.gender] : ['man', 'woman'], L = [];
    const pairs = C.pairs.length ? C.pairs : C.chests.flatMap((c) => C.legs.map((l) => [c, l]));
    for (const [chest, legs] of pairs) for (const gender of genders) for (const f of C.views) L.push([gender + ' ' + chest + ' / ' + legs + ' ' + VIEW[f], C.clips.map((n) => {
      const { weapon, ...k } = CLIP[n](), d = dress(chest, legs, weapon);
      return { gender, facing: f, zoom, ...k, ...d, crop: C.full ? undefined : CROP[n] ?? [0.18, 0.28, 0.82, 0.92], label: n };
    })]);
    rows('Chest over legs in the clips, the game renderer, zoom ' + zoom, L);
  },
};
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };`;
// (--keep: every legs triangle drawn under every chest, as before the table: its drop lists emptied as it is bundled)
const keepAll = { name: 'keep', setup: (bu) => bu.onLoad({ filter: /lowchestlegs-(male|female)\.json$/ }, (a) => {
  const t = JSON.parse(readFileSync(a.path, 'utf8'));
  for (const [c, row] of Object.entries(t)) if (c !== 'built') for (const l of Object.keys(row)) { row[l].drop = []; row[l].show = []; }
  return { contents: JSON.stringify(t), loader: 'json' };
}) };
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', plugins: args.includes('--keep') ? [keepAll] : [], loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:13px sans-serif;color:#eee}#root{display:inline-block;padding:6px}.row{display:flex;gap:4px;margin:4px 0;align-items:flex-end}.c{display:flex;flex-direction:column;align-items:center}.m{width:120px;flex:none}.h{font-weight:bold;margin:2px 0 6px}.l{font-size:12px}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  await p.evaluate(([s, z]) => window.sheets[s](z), [sheet, zoom]);
  const r = await p.evaluate(() => { const b = document.querySelector('#root').getBoundingClientRect(); return { x: b.x, y: b.y, width: Math.ceil(b.width), height: Math.ceil(b.height) }; });
  await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
  await p.screenshot({ path: file, clip: r, timeout: 300000 });
  console.log('wrote', file);
} finally {
  await browser.close();
}
