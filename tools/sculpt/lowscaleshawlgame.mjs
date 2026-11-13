// The scale set's wing mantle (tools/sculpt/garments/scaleshawl.mjs, outfit.scaleShawl) in the game's own renderer:
// drawFigure with the "Sculpted figures" switch on (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL), worn over
// the scale cuirass, leggings and boots; a sheet of cells, each a figure in its own pose, outfit and gear.
//
//   node tools/sculpt/lowscaleshawlgame.mjs --set <name> --out <file.png> [--zoom 10]
//     views: both bodies front, three-quarter, side, rear three-quarter and back, a row plain and a row enchanted;
//     helms: the wings under the scale helm, the plate helm, the chain coif and the leather hat;
//     compare: the cloth shawl's, the leather shawl's, the plate mantle's and the wing mantle's wearers side by side, at
//       three-quarter, front, side and back (at --zoom: 3 and 6 for the game's own; --pick scale,plate and --faces 1,4
//       for fewer);
//     clips: the one-handed fight (a sword), the overhead swing (a long sword), the bow's draw, the work at the ground
//       (kneeling) and riding (astride, the reins in hand, no mount drawn), each at its key frames, three-quarter and rear
//       three-quarter (--clips fight,swing,bow,kneel,riding for some);
//     walk: the walk and the idle, front, side and back.
//   --crop x0,y0,x1,y1: every cell cut to that box (shares of the cell), for a close look.
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowscaleshawlgame.png')), SET = opt('set', 'views'), Z = +opt('zoom', '10');
const ROOT = new URL('../..', import.meta.url).pathname;

/** The scale set worn whole but the helm, the wing mantle over it (plain, or every piece enchanted). */
const SCALE = (lit = false, extra = {}) => ({ outfit: { scaleChest: true, scaleLegs: true, scaleBoots: true, scaleShawl: true, ...extra, enchanted: Object.fromEntries(['scaleChest', 'scaleLegs', 'scaleBoots', 'scaleShawl', 'scaleHelm'].map((k) => [k, lit])) } });
const FACES = [[0, 'front'], [1, '3/4'], [2, 'side'], [3, 'rear 3/4'], [4, 'back']];
const SETS = {
  views: () => [false, true].flatMap((lit) => ['man', 'woman'].map((gender) => FACES.map(([facing, f]) => ({ zoom: Z, gender, facing, ...SCALE(lit), label: `${gender} ${f}${lit ? ' enchanted' : ''}` })))),
  helms: () => [['scale helm', { outfit: { scaleHelm: true } }], ['plate helm', { outfit: { plateHelm: true } }], ['chain coif', { outfit: { chainCoif: true } }], ['leather hat', { outfit: { leatherHat: true } }]]
    .map(([n, h]) => ['man', 'woman'].flatMap((gender) => [[0, 'front'], [1, '3/4'], [2, 'side'], [4, 'back']].map(([facing, f]) => ({ zoom: Z, gender, facing, ...SCALE(false, h.outfit), label: `${gender} ${n} ${f}` })))),
  compare: () => {
    const who = {
      cloth: { outfit: { shawl: true, tunic: true, trousers: true, boots: true } },
      leather: { outfit: { shawl: false, tunic: false, trousers: false, boots: false, leatherShawl: true, leatherChest: true, leatherLegs: true, leatherBoots: true } },
      plate: { outfit: { shawl: false, tunic: false, trousers: false, boots: false, plateMantle: true, plateChest: true, plateLegs: true, plateBoots: true } },
      scale: SCALE(false),
    };
    const pick = opt('pick', 'cloth,leather,plate,scale').split(','), faces = opt('faces', '1,0,2,4').split(',').map(Number);
    return ['man', 'woman'].map((gender) => faces.flatMap((facing) => Object.entries(who).filter(([n]) => pick.includes(n)).map(([n, o]) => ({ zoom: Z, gender, facing, ...o, label: Z > 3 ? `${n}` : '' }))));
  },
  clips: () => {
    const fight = (weapon, t, length) => ({ working: true, job: 'attack_creature', act: { t, length }, gear: { weapon: { id: weapon } } });
    const SADDLE = { hands: 'reins', up: 0, astride: true, grip: [0, 7.5, 2.5] };
    const C = [
      ['fight raised', fight('sword', 0.45, 1)], ['fight blow', fight('sword', 0.62, 1)], ['fight impact', fight('sword', 0.8, 1)],
      ['swing up', fight('long_sword', 1.1, 2)], ['swing top', fight('long_sword', 1.38, 2)], ['swing blow', fight('long_sword', 1.66, 2)],
      ['bow drawn', fight('long_bow', 0.8, 2.2)], ['bow loosed', fight('long_bow', 1.32, 2.2)], ['bow quiver', fight('long_bow', 1.72, 2.2)],
      ['kneel dig', { working: true, job: 'plant', act: { t: 0.35, length: 1.4 } }], ['kneel reach', { working: true, job: 'plant', act: { t: 0.75, length: 1.4 } }],
      ['riding', { driving: true, seat: SADDLE }],
    ];
    // (--clips fight,swing,bow,kneel,riding: only those; a kneel's or a rider's cell cut lower, where the body is)
    const want = opt('clips', 'fight,swing,bow,kneel,riding').split(','), low = [0.1, 0.4, 0.9, 1];
    return ['man', 'woman'].flatMap((gender) => [1, 3].map((facing) => C.filter(([n]) => want.includes(n.split(' ')[0])).map(([n, p]) => ({ zoom: Z, gender, facing, ...SCALE(false), pose: p, label: `${gender} ${n}`, ...(/kneel/.test(n) ? { crop: low } : /riding/.test(n) ? { dy: 16 } : {}) }))));
  },
  walk: () => ['man', 'woman'].map((gender) => [[0, 0.4], [2, 0.4], [2, 2.0], [4, 2.0], [1, 3.0]].map(([facing, phase], k) => ({ zoom: Z, gender, facing, ...SCALE(false), moving: k < 4, phase, label: `${gender} ${k < 4 ? 'walk' : 'idle'}` }))),
};
const spec = { rows: SETS[SET]() };
// (--crop x0,y0,x1,y1: each cell cut to that box, shares of its width and height)
const CROP = opt('crop', null)?.split(',').map(Number);
if (CROP) for (const row of spec.rows) for (const c of row) c.crop ??= CROP;

const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
const look = (gender, hair) => ({ ...DEFAULT_LOOK, gender, hair: hair ?? 'swept', beard: 'none' });
const size = (zoom) => [Math.ceil(36 * zoom) + 30, Math.ceil(46 * zoom) + 24];
window.cell = (c) => {
  const [cw, ch] = size(c.zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = c.bg ?? '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 2 * c.zoom - 8 - (c.dy ?? 0) * c.zoom, c.zoom, { phase: c.phase ?? 1.5, moving: !!c.moving, facing: c.facing ?? 0, swimming: false, working: false,
    look: look(c.gender ?? 'man', c.hair), ...(c.gear ? { gear: c.gear } : {}), ...(c.outfit ? { outfit: c.outfit } : {}), ...(c.pose ?? {}) });
  let o = cv;
  if (c.crop) {
    const [x0, y0, x1, y1] = c.crop, w = Math.round((x1 - x0) * cw), h = Math.round((y1 - y0) * ch);
    o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(cv, -Math.round(x0 * cw), -Math.round(y0 * ch));
  }
  const go = o.getContext('2d');
  if (c.label) { go.font = '12px sans-serif'; go.fillStyle = '#fff'; go.fillText(c.label, 4, 13); }
  return o;
};
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
window.show = (rows) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  for (const row of rows) { const r = document.createElement('div'); r.className = 'row'; for (const c of row) r.appendChild(window.cell(c)); root.appendChild(r); }
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b}#root{display:inline-block}.row{display:flex}canvas{display:block}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  await p.evaluate((rows) => window.show(rows), spec.rows);
  const r = await p.evaluate(() => { const b = document.getElementById('root').getBoundingClientRect(); return { x: b.x, y: b.y, width: Math.ceil(b.width), height: Math.ceil(b.height) }; });
  await p.setViewportSize({ width: Math.max(1200, r.width), height: Math.max(800, r.height) });
  await p.screenshot({ path: out, clip: r, timeout: 300000 });
  console.log('wrote', out);
} finally {
  await browser.close();
}
