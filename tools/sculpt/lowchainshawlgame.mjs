// The chain set's shawl (outfit.chainShawl, tools/sculpt/garments/chainshawl.mjs) in the game's own renderer: drawFigure
// with the "Sculpted figures" switch on (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL), a sheet of labelled
// rows of cells, each a figure as the island draws it.
//
//   node tools/sculpt/lowchainshawlgame.mjs --sheet <sheet.json> --out <file.png>
//     sheet.json: { title, rows: [{ label, cells: [{ label, zoom, gender, facing, pose: { ...FigurePose fields },
//       outfit: { ...FigurePose.outfit }, gear: { ...FigurePose.gear }, w, h }] }] }
//     Each cell drawn on the grass colour, the figure stood at its foot; `pose` laid over a standing idle body
//     (phase 1.5, hair swept, no beard); w and h the cell's size in game units (default 34 by 50) times the zoom.
//   or --sheet sets:<zoom> (built in: the chain shawl and the cloth, leather and plate shawl-wearers side by side,
//     both bodies, front, three-quarter, side and back).
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel; the sheet composed
// in the page.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowchainshawlgame.png')), sheetArg = opt('sheet', 'sets:3');
/** The sets worn under each shawl: the chain set (iron), the cloth outfit, the leather set, the plate set (steel). */
export const SETS = {
  chain: { chainShawl: true, chainChest: true, chainLegs: true, chainBoots: true, metal: { chainShawl: 'iron', chainChest: 'iron', chainLegs: 'iron', chainBoots: 'iron' } },
  cloth: {},
  leather: { leatherChest: true, leatherLegs: true, leatherBoots: true, leatherShawl: true },
  plate: { plateMantle: true, plateChest: true, plateLegs: true, plateBoots: true, metal: { chest: 'steel', legs: 'steel', boots: 'steel' } },
};
const sheet = sheetArg.startsWith('sets:') ? (() => {
  const z = +sheetArg.slice(5), F = [[0, 'front'], [1, '3/4'], [2, 'side'], [4, 'back']];
  return { title: `The chain shawl beside the cloth, leather and plate shawl-wearers, the game's renderer at zoom ${z}`, rows: ['man', 'woman'].map((gender) => ({ label: gender, cells: F.flatMap(([facing, fl]) => Object.entries(SETS).map(([k, o]) => ({ label: `${k} ${fl}`, zoom: z, gender, facing, outfit: o }))) })) };
})() : JSON.parse(readFileSync(sheetArg, 'utf8'));
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
const cell = (c) => {
  const z = c.zoom ?? 6, cw = Math.ceil((c.w ?? 34) * z), ch = Math.ceil((c.h ?? 50) * z) + 8, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 2 * z - 6, z, { phase: 1.5, moving: false, facing: c.facing ?? 0, swimming: false, working: false, look: { ...DEFAULT_LOOK, gender: c.gender ?? 'man', hair: 'swept', beard: 'none' }, ...(c.gear ? { gear: c.gear } : {}), ...(c.outfit ? { outfit: c.outfit } : {}), ...(c.pose ?? {}) });
  return cv;
};
window.show = (S) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  const h = document.createElement('div'); h.className = 'h'; h.textContent = S.title ?? ''; root.appendChild(h);
  for (const r of S.rows) {
    if (r.label) { const l = document.createElement('div'); l.className = 'h2'; l.textContent = r.label; root.appendChild(l); }
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (const c of r.cells) { const b = document.createElement('div'); b.className = 'c'; b.appendChild(cell(c)); const l = document.createElement('div'); l.className = 'l'; l.textContent = c.label ?? ''; b.appendChild(l); row.appendChild(b); }
  }
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:13px sans-serif;color:#eee}#root{display:inline-block;padding:4px}.row{display:flex;gap:4px;align-items:flex-start}.c{display:flex;flex-direction:column}.l{padding:2px 2px 6px;max-width:200px}.h{padding:4px 2px;font-weight:600;font-size:15px}.h2{padding:4px 2px;font-weight:600}canvas{display:block}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  await p.evaluate((S) => window.show(S), sheet);
  const r = await p.evaluate(() => { const q = document.getElementById('root').getBoundingClientRect(); return { x: q.x, y: q.y, width: Math.ceil(q.width), height: Math.ceil(q.height) }; });
  await p.setViewportSize({ width: Math.max(1200, r.width), height: Math.max(800, r.height) });
  await p.screenshot({ path: out, clip: r, timeout: 300000 });
  console.log('wrote', out);
} finally {
  await browser.close();
}
