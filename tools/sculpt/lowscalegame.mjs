// The scale set (tools/sculpt/garments/scale*.mjs) in the game's own renderer: drawFigure with the "Sculpted figures"
// switch on (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL), as tools/sculpt/lowoutfitgame.mjs draws the
// first outfit; a sheet of cells, each a figure in its own pose, outfit and gear.
//
//   node tools/sculpt/lowscalegame.mjs --spec <file.json> --out <file.png>
//     the spec: { rows: [[cell, ...], ...] }, each cell { zoom, gender ('man' | 'woman'), facing (0 front, 1 three-quarter,
//     2 side, 3 rear three-quarter, 4 back), moving, phase, gear (FigurePose.gear), outfit (FigurePose.outfit), working,
//     job, act ({ t, length }: a go of a timed job, its time in), label }; or --set: the built-in sheets by name
//     (`node tools/sculpt/lowscalegame.mjs --set views --out ...`, see SETS below).
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowscalegame.png'));
const ROOT = new URL('../..', import.meta.url).pathname;

/** The scale set worn whole: as equipped (FigurePose.gear), the first outfit's pieces giving way to it. */
const SCALE_GEAR = { head: { id: 'scale_helm' }, chest: { id: 'scale_cuirass' }, shawl: { id: 'scale_shawl' }, legs: { id: 'scale_leggings' }, feet: { id: 'scale_boots' } };
const enchant = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { ...v, enchanted: true }]));
/** Built-in sheets: `views` the set at zoom 10, both bodies, five facings, idle and walk; `game` the same at zoom 2.5. */
const SETS = {
  views: (gear = SCALE_GEAR, zoom = 10) => ['man', 'woman'].flatMap((g) => [false, true].map((moving) => [0, 1, 2, 3, 4].map((f) => ({ zoom, gender: g, facing: f, moving, phase: moving ? 1.1 : 1.5, gear: { weapon: { id: 'long_sword' }, ...gear } })))),
};

const spec = opt('set', null) ? { rows: SETS[opt('set')](opt('gear') ? JSON.parse(opt('gear')) : SCALE_GEAR, +opt('zoom', '10')) } : JSON.parse(readFileSync(opt('spec'), 'utf8'));
if (args.includes('--enchanted')) for (const row of spec.rows) for (const c of row) c.gear = enchant(c.gear ?? {});

const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
const look = (gender, hair) => ({ ...DEFAULT_LOOK, gender, hair: hair ?? 'swept', beard: 'none' });
const size = (zoom) => [Math.ceil(44 * zoom) + 30, Math.ceil(48 * zoom) + 24];
window.cell = (c) => {
  const [cw, ch] = size(c.zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = c.bg ?? '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 2 * c.zoom - 8, c.zoom, { phase: c.phase ?? 1.5, moving: !!c.moving, facing: c.facing ?? 0, swimming: false, working: !!c.working,
    ...(c.job ? { job: c.job } : {}), ...(c.act ? { act: c.act } : {}), ...(c.tool ? { tool: c.tool } : {}), look: look(c.gender ?? 'man', c.hair),
    ...(c.gear ? { gear: c.gear } : {}), ...(c.outfit ? { outfit: c.outfit } : {}) });
  if (c.label) { g.font = '12px sans-serif'; g.fillStyle = '#fff'; g.fillText(c.label, 6, 14); }
  return cv;
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
  // (--crop top,bottom: only that share of the sheet's height, for a close look at a row)
  const crop = opt('crop', null)?.split(',').map(Number);
  const clip = crop ? { ...r, y: r.y + r.height * crop[0], height: Math.ceil(r.height * (crop[1] - crop[0])) } : r;
  await p.screenshot({ path: out, clip, timeout: 300000 });
  console.log('wrote', out);
} finally {
  await browser.close();
}
