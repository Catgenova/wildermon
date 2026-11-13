// The chain set (tools/sculpt/garments/chaincoif.mjs, chainchest.mjs, chainlegs.mjs, chainboots.mjs) on both low-poly
// bodies in the game's own renderer: drawFigure with the "Sculpted figures" switch on, as the island draws a body
// (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL, its bloom included), each body dressed from what it has
// equipped (`FigurePose.gear`, through src/sculpt/lowpoly.ts outfitOf), every piece in the metal it was smithed from.
//
//   node tools/sculpt/lowchaingame.mjs --out <dir> --sheet <name> [--file <png>] [--pieces coif,hauberk,sleeves,leggings,boots]
//       [--metal iron] [--zoom 10]
//     sheets:
//       views: him then her, idle and walk, front, 3/4, side and back at --zoom, plain and enchanted (3/4), and a row at
//         the game's zoom (2 and 3), idle and walk;
//       metals: the whole set in iron, steel, copper, gold, adamantine and mithril, both bodies, 3/4 at 6 and at 3;
//       mixed: chain mixed with the plate and the leather sets' pieces (and the first outfit's), both bodies;
//       clips: a frame from each clip the bodies play (idle, walk, the overhead swing in a fight with the maul, the
//         placeholder in a fight with the long sword, the bench work with the hammer, the hands, the ground), 3/4 and side;
//       (--only <clip,...>: those clips alone, from 3/4, rear 3/4 and the left side, for a closer look)
//       glow: chain beside plate, plain and enchanted; legs: the hauberk over --legs cloth|leather|plate|chain, idle and walk;
//       crotch: the leggings alone, close, idle, walk and knelt;
//       compare: chain, plate and leather side by side, front and 3/4 at --zoom and at 3, both bodies.
//     --pieces: the chain pieces worn (all five unless given); the rest of the first outfit stays under what they do not
//     replace.
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowchaingame'));
const sheet = opt('sheet', 'views'), zoom = +opt('zoom', '10'), metal = opt('metal', 'iron');
const file = resolve(opt('file', join(out, `chain-${sheet}.png`)));
const pieces = opt('pieces', 'coif,hauberk,sleeves,leggings,boots').split(',');
mkdirSync(dirname(file), { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
import { CLIPS } from './src/sculpt/anim';
const BG = '#7d9b5e';
const PIECES = ${JSON.stringify(pieces)};
const LEGS = ${JSON.stringify(opt('legs', 'cloth'))};
const ONLY = ${JSON.stringify(opt('only', '').split(',').filter(Boolean))};
const SLOT = { coif: ['head', 'chain_coif'], hauberk: ['chest', 'chain_hauberk'], sleeves: ['arms', 'chain_sleeves'], leggings: ['legs', 'chain_leggings'], boots: ['feet', 'chain_boots'] };
/** The chain pieces worn, in a metal, enchanted or not. */
const chain = (material, lit = false, only = PIECES) => Object.fromEntries(only.map((k) => [SLOT[k][0], { id: SLOT[k][1], material, ...(lit ? { enchanted: true } : {}) }]));
const plate = (material, lit = false) => Object.fromEntries([['head', 'helm'], ['chest', 'plate_breastplate'], ['arms', 'plate_arms'], ['legs', 'plate_legs'], ['feet', 'plate_boots']].map(([s, id]) => [s, { id, material, ...(lit ? { enchanted: true } : {}) }]));
const leather = () => ({ head: { id: 'leather_cap' }, chest: { id: 'leather_jerkin' }, arms: { id: 'leather_sleeves' }, legs: { id: 'leather_trousers' }, feet: { id: 'leather_boots' } });
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: gender === 'woman' ? 'braid' : 'swept', beard: 'none' });
const lab = (t, cls = 'l') => { const d = document.createElement('div'); d.className = cls; d.textContent = t; return d; };
const size = (z) => [Math.ceil(40 * z) + 24, Math.ceil(50 * z) + 24];
/** One figure: { gender, facing, zoom, phase, moving, gear, working, job, act, tool }. */
function cell(c) {
  const z = c.zoom, [cw, ch] = size(z), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = BG; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 3 * z - 8, z, { phase: c.phase ?? 1.5, moving: !!c.moving, facing: c.facing, swimming: false, working: !!c.working, look: look(c.gender), gear: c.gear,
    ...(c.job ? { job: c.job } : {}), ...(c.act ? { act: c.act } : {}), ...(c.tool ? { tool: c.tool } : {}), ...(c.outfit ? { outfit: c.outfit } : {}) });
  if (!c.crop) return cv;
  // (c.crop: [x0, y0, x1, y1], shares of the cell kept)
  const [x0, y0, x1, y1] = c.crop.map((f, k) => Math.round(f * (k % 2 ? ch : cw))), o = document.createElement('canvas');
  o.width = x1 - x0; o.height = y1 - y0; o.getContext('2d').drawImage(cv, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
function rows(title, list) {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab(title, 'h'));
  for (const [name, cells] of list) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    row.appendChild(lab(name, 'm'));
    for (const c of cells) { const box = document.createElement('div'); box.className = 'c'; box.appendChild(cell(c)); if (c.label) box.appendChild(lab(c.label)); row.appendChild(box); }
  }
}
const VIEWS = [[0, 'front'], [1, '3/4'], [2, 'side'], [4, 'back']];
const WALK = 0.9;
window.sheets = {
  views: (zoom, metal) => {
    const L = [];
    for (const gender of ['man', 'woman']) {
      L.push([gender + ' idle', VIEWS.map(([f, v]) => ({ gender, facing: f, zoom, gear: chain(metal), label: v }))]);
      L.push([gender + ' walk', VIEWS.map(([f, v]) => ({ gender, facing: f, zoom, moving: true, phase: WALK, gear: chain(metal), label: v }))]);
    }
    L.push(['enchanted', [['man', 1], ['man', 3], ['woman', 1], ['woman', 3]].map(([gender, f]) => ({ gender, facing: f, zoom, gear: chain(metal, true), label: gender + ' lit' }))]);
    for (const z of [2, 3]) L.push(['game z' + z, ['man', 'woman'].flatMap((gender) => [[0, false], [1, false], [2, true], [4, false], [1, true]].map(([f, mv]) => ({ gender, facing: f, zoom: z, moving: mv, phase: mv ? WALK : 1.5, gear: chain(metal) }))).concat(['man', 'woman'].map((gender) => ({ gender, facing: 1, zoom: z, gear: chain(metal, true) })))]);
    rows('Chain (' + PIECES.join(', ') + ') in ' + metal + ', the game renderer, zoom ' + zoom, L);
  },
  metals: () => {
    const M = ['iron', 'steel', 'copper', 'gold', 'adamantine', 'mithril'];
    const L = [];
    for (const z of [6, 3]) for (const gender of ['man', 'woman']) L.push([gender + ' z' + z, M.map((m) => ({ gender, facing: 1, zoom: z, gear: chain(m), label: m }))]);
    L.push(['lit z6', M.map((m, i) => ({ gender: i % 2 ? 'woman' : 'man', facing: 7, zoom: 6, gear: chain(m, true), label: m + ' lit' }))]);
    rows('The chain set in each metal (GearPiece.material), 3/4', L);
  },
  mixed: (zoom) => {
    const mixes = [
      ['hauberk + plate legs/boots + helm', { ...plate('steel'), chest: { id: 'chain_hauberk', material: 'iron' }, arms: { id: 'chain_sleeves', material: 'iron' } }],
      ['plate chest + chain legs/boots/coif', { ...chain('iron', false, ['coif', 'leggings', 'boots']), chest: { id: 'plate_breastplate', material: 'gold' }, arms: { id: 'plate_arms', material: 'gold' } }],
      ['leather jerkin + chain legs/boots', { ...leather(), ...chain('copper', false, ['leggings', 'boots']), head: { id: 'leather_cap' } }],
      ['chain hauberk + leather legs/boots/cap', { ...leather(), ...chain('mithril', false, ['hauberk', 'sleeves']) }],
      ['coif alone (first outfit)', chain('steel', false, ['coif'])],
      ['sleeves alone', chain('steel', false, ['sleeves'])],
      ['leggings + cloth', chain('iron', false, ['leggings'])],
      ['boots + cloth', chain('iron', false, ['boots'])],
    ];
    const L = [];
    for (const gender of ['man', 'woman']) L.push([gender, mixes.map(([n, gear]) => ({ gender, facing: 1, zoom, gear, label: n }))]);
    L.push(['back', mixes.map(([n, gear], i) => ({ gender: i % 2 ? 'woman' : 'man', facing: 3, zoom, gear, label: n }))]);
    rows('Chain mixed with other sets, 3/4', L);
  },
  clips: (zoom, metal) => {
    const g = chain(metal), maul = { ...g, weapon: { id: 'maul', material: metal } }, sword = { ...g, weapon: { id: 'long_sword', material: metal } };
    const C = [
      ['idle', (gender, f) => ({ gender, facing: f, zoom, gear: sword, phase: 3 })],
      ['walk a', (gender, f) => ({ gender, facing: f, zoom, gear: g, moving: true, phase: 0.4 })],
      ['walk b', (gender, f) => ({ gender, facing: f, zoom, gear: g, moving: true, phase: 2.0 })],
      ['swing up', (gender, f) => ({ gender, facing: f, zoom, gear: maul, working: true, job: 'attack_creature', act: { t: 0.7, length: 2 } })],
      ['swing blow', (gender, f) => ({ gender, facing: f, zoom, gear: maul, working: true, job: 'attack_creature', act: { t: 1.15, length: 2 } })],
      ['fight (sword)', (gender, f) => ({ gender, facing: f, zoom, gear: sword, working: true, job: 'attack_creature', act: { t: 0.6, length: 2 } })],
      ['mine', (gender, f) => ({ gender, facing: f, zoom, gear: g, working: true, job: 'mine', tool: { id: 'pickaxe', material: metal }, act: { t: 0.8, length: 2 } })],
      ['work (hammer)', (gender, f) => ({ gender, facing: f, zoom, gear: g, working: true, job: 'build_wall', tool: { id: 'hammer', material: metal }, act: { t: 0.9, length: 3 } })],
      ['hands', (gender, f) => ({ gender, facing: f, zoom, gear: g, working: true, job: 'repair_item', act: { t: 1, length: 3 } })],
      ['ground', (gender, f) => ({ gender, facing: f, zoom, gear: g, working: true, job: 'plant', act: { t: 1.2, length: 3 } })],
    ];
    const L = [];
    const only = ONLY.length ? C.filter(([n]) => ONLY.includes(n)) : C, facings = ONLY.length ? [1, 3, 6] : [1, 2];
    for (const gender of ['man', 'woman']) for (const f of facings) L.push([gender + ' ' + ['front', '3/4', 'side', 'rear 3/4', 'back', '', 'left side', ''][f], only.map(([n, mk]) => ({ ...mk(gender, f), label: n }))]);
    rows('Chain in every clip (' + metal + '), zoom ' + zoom, L);
  },
  close: (zoom, metal) => {
    rows('Close, ' + metal + ', zoom ' + zoom + ': plain and enchanted', [['', [['man', 1, false], ['man', 1, true], ['woman', 0, false], ['woman', 7, true], ['man', 4, false]].map(([gender, f, lit]) => ({ gender, facing: f, zoom, gear: chain(metal, lit), label: lit ? 'enchanted' : 'plain' }))]]);
  },
  glow: (zoom, metal) => {
    // (the same light, side by side: the chain set and the plate set, plain and enchanted)
    const L = [];
    for (const z of [zoom, 3]) for (const gender of ['man', 'woman']) L.push([gender + ' z' + z, [[chain, 'chain'], [plate, 'plate']].flatMap(([set, n]) => [[0, false], [0, true], [1, true]].map(([f, lit]) => ({ gender, facing: f, zoom: z, gear: set(metal, lit), label: n + (lit ? ' enchanted' : ' plain') })))]);
    rows('Enchanted: chain beside plate (' + metal + '), the game renderer', L);
  },
  legs: (zoom, metal) => {
    // (the hauberk and sleeves over one set's legs: --legs cloth (the first outfit's trousers), leather, plate, chain)
    const legs = { cloth: {}, leather: { legs: { id: 'leather_trousers' } }, plate: { legs: { id: 'plate_legs', material: 'steel' } }, chain: { legs: { id: 'chain_leggings', material: 'steel' } } }[LEGS];
    const gear = { ...legs, ...chain(metal, false, ['hauberk', 'sleeves']) };
    const L = [];
    for (const gender of ['man', 'woman']) for (const mv of [false, true]) L.push([gender + (mv ? ' walk' : ' idle'), VIEWS.map(([f, v]) => ({ gender, facing: f, zoom, moving: mv, phase: mv ? WALK : 1.5, gear, label: v }))]);
    rows('The hauberk (' + metal + ') over the ' + LEGS + ' legs, zoom ' + zoom, L);
  },
  crotch: (zoom, metal) => {
    // (the leggings alone, nothing over the hips, close: idle, walk, knelt)
    const outfit = { shawl: false, tunic: false, trousers: false, chainLegs: true, metal: { chainLegs: metal } };
    const C = [['idle', {}], ['walk', { moving: true, phase: WALK }], ['ground', { working: true, job: 'plant', act: { t: 1.2, length: 3 } }]];
    const L = [];
    // (each cell cropped to the hips: the ground's, where the body kneels, lower)
    for (const gender of ['man', 'woman']) L.push([gender, C.flatMap(([n, o]) => [0, 1, 4].map((f) => ({ gender, facing: f, zoom, outfit, ...o, crop: n === 'ground' ? [0.2, 0.6, 0.8, 1] : gender === 'man' ? [0.3, 0.45, 0.7, 0.75] : [0.3, 0.48, 0.7, 0.78], label: n + ' ' + ['front', '3/4', '', '', 'back'][f] })))]);
    rows('The leggings alone at the crotch (' + metal + '), zoom ' + zoom, L);
  },
  compare: (zoom) => {
    const sets = [['chain', chain('iron')], ['plate', plate('iron')], ['leather', leather()]];
    const L = [];
    for (const z of [zoom, 3]) for (const gender of ['man', 'woman']) L.push([gender + ' z' + z, sets.flatMap(([n, gear]) => [0, 1].map((f) => ({ gender, facing: f, zoom: z, gear, label: n })))]);
    rows('Chain, plate and leather (iron), the game renderer', L);
  },
};
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
void CLIPS;`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:13px sans-serif;color:#eee}#root{display:inline-block;padding:6px}.row{display:flex;gap:4px;margin:4px 0;align-items:flex-end}.c{display:flex;flex-direction:column;align-items:center}.m{width:90px;flex:none}.h{font-weight:bold;margin:2px 0 6px}.l{font-size:12px}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  await p.evaluate(([s, z, m]) => window.sheets[s](z, m), [sheet, zoom, metal]);
  const r = await p.evaluate(() => { const b = document.querySelector('#root').getBoundingClientRect(); return { x: b.x, y: b.y, width: Math.ceil(b.width), height: Math.ceil(b.height) }; });
  await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
  await p.screenshot({ path: file, clip: r, timeout: 300000 });
  console.log('wrote', file);
} finally {
  await browser.close();
}
