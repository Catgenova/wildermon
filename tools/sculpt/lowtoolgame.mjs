// The Runecut hand tools (tools/sculpt/gear/hammer.mjs, mallet.mjs, chisel.mjs, hatchet.mjs, butchering_knife.mjs) in the
// game's own renderer (drawSculptGL, src/sculpt/lowpoly.ts): each alone in the metals, plain and enchanted, and each held
// still in its fist by both bodies (lowHoldScene: no clip draws them yet, the work clip is on its own branch).
//
//   node tools/sculpt/lowtoolgame.mjs --out <dir> [--what swatch,held] [--zoom 9] [--zooms 3,8]
//     swatch: <dir>/tools-swatch.png, each tool alone (lowPropDraw) in five metals and in none, plain and enchanted;
//     held: <dir>/tools-held-z<zoom>.png, both bodies, each tool in the right fist (the chisel in the left), the arm raised
//       to the work (its turns found by tools/sculpt/lowgear.mjs reach on the rig: the fist in front at the bench's
//       height, the haft up), front, 3/4, side and back, plain and enchanted.
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig, posed } from './lowrig.mjs';
import { reach, gameScale, socketAt, colOf } from './lowgear.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowtoolgame'));
const what = new Set(opt('what', 'swatch,held').split(','));
const ZOOM = +opt('zoom', '22');
const zooms = opt('zooms', '3,8').split(',').map(Number).filter((z) => z > 0);
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const TOOLS = [['hammer', 'Hammer'], ['mallet', 'Mallet'], ['chisel', 'Chisel'], ['hatchet', 'Hatchet'], ['butchering_knife', 'Cleaver']];

/* ---- the arm raised to the work: each body's turns, by the hand the tool is in ----------------------------------- */
const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const frame = (x0, y) => { const yy = unit(y), d = x0[0] * yy[0] + x0[1] * yy[1] + x0[2] * yy[2], xx = unit(x0.map((v, k) => v - yy[k] * d)), z = cross(xx, yy); return [xx[0], yy[0], z[0], xx[1], yy[1], z[1], xx[2], yy[2], z[2]]; };
/** The hold, body heights: the right fist raised beside the chest, the haft upright, the blow's way across to the body's left; the chisel's left fist in front of the left hip, upright. */
const HOLD = {
  r: { o: [-0.2, 0.7, 0.12], y: [-0.1, 0.97, 0.1], x: [0.8, -0.1, 0.55] },
  l: { o: [0.16, 0.6, 0.14], y: [0.05, 1, 0.1], x: [-0.3, 0.1, 1] },
};
const TURNS = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who), sc = await gameScale(rig), H = sc.mesh, floor = rig.J.floor;
  TURNS[who] = {};
  for (const [id] of TOOLS) {
    const A = JSON.parse(readFileSync(join(ROOT, `src/sculpt/assets/${id}.json`), 'utf8')), side = A.hand ?? 'r', so = A.sockets[who][side];
    const s = { side, o: so.o, R: so.R, bone: rig.at.get(so.bone) };
    const h = HOLD[side], target = { o: [h.o[0] * H, floor + h.o[1] * H, h.o[2] * H], R: frame(h.x, h.y) };
    const r = reach(rig, {}, s, target, { wPos: 6, clavicle: true });
    const keep = Object.fromEntries(Object.entries(r.pose).filter(([b]) => /^(clavicle|upperarm|lowerarm|hand)_/.test(b)).map(([b, e]) => [b, e.map((v) => +v.toFixed(2))]));
    TURNS[who][id] = keep;
    const S = socketAt(rig, posed(rig, r.pose), s);
    console.log(who, id, side, 'reach err', r.err.pos.toFixed(3), r.err.ang.map((a) => a.toFixed(0)).join('/'), 'haft', colOf(S.R, 1).map((v) => v.toFixed(2)).join(','));
  }
}

const entry = `
import { drawSculptGL } from './src/sculpt/gl';
import { sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
import { lowPropDraw, lowHoldScene } from './src/sculpt/lowpoly';
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' });
const TOOLS = ${JSON.stringify(TOOLS)};
const VIEWS = [[0, 'front'], [1, '3/4'], [2, 'side'], [7, '3/4 r'], [4, 'back']];
const BG = '#7d9b5e';
const lab = (t, cls = 'l') => { const d = document.createElement('div'); d.className = cls; d.textContent = t; return d; };
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
function propCell(id, piece, yaw, zoom) {
  const d = lowPropDraw(id, piece, yaw), w = Math.ceil(40 * zoom), h = Math.ceil(50 * zoom);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  drawSculptGL(g, w / 2, h - 10 * zoom, zoom, d, { dpr: 1 });
  const px = g.getImageData(0, 0, w, h).data;
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const o = document.createElement('canvas'), pad = 6; o.width = Math.max(1, x1 - x0 + 1) + pad * 2; o.height = Math.max(1, y1 - y0 + 1) + pad * 2;
  const og = o.getContext('2d'); og.fillStyle = BG; og.fillRect(0, 0, o.width, o.height);
  if (x1 >= x0) og.drawImage(cv, x0, y0, x1 - x0 + 1, y1 - y0 + 1, pad, pad, x1 - x0 + 1, y1 - y0 + 1);
  return o;
}
window.swatch = (zoom, metals) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('The hand tools in each metal (the game renderer, lowPropDraw), zoom ' + zoom + ': plain, enchanted (its emissive parts; the bloom adds the glow in play); the last row no metal (iron, the fallback). The mallet is wood only.', 'h'));
  for (const metal of [...metals, undefined]) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    row.appendChild(lab(metal ?? 'none', 'm'));
    for (const [id] of TOOLS) for (const lit of [false, true]) {
      const box = document.createElement('div'); box.className = 'c';
      box.appendChild(propCell(id, { id, material: metal, enchanted: lit }, id === 'chisel' ? 250 : 200, zoom));
      box.appendChild(lab(TOOLS.find((t) => t[0] === id)[1] + (lit ? ' lit' : ''), 'l'));
      row.appendChild(box);
    }
  }
};
const size = (zoom) => [Math.ceil(44 * zoom), Math.ceil(70 * zoom)];
window.held = (zoom, turns, sets) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('Held still in its fist (lowHoldScene), the game renderer, zoom ' + zoom + ': front, 3/4, side, 3/4 from the right, back; the chisel in the left fist', 'h'));
  for (const [gender, who] of [['man', 'male'], ['woman', 'female']]) for (const [id, metal, lit] of sets) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    row.appendChild(lab(gender + '\\n' + id + '\\n' + (metal ?? 'wood') + (lit ? '\\nenchanted' : ''), 'm'));
    for (const [facing, v] of VIEWS) {
      const [cw, ch] = size(zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const g = cv.getContext('2d'); g.fillStyle = BG; g.fillRect(0, 0, cw, ch);
      const pose = { phase: 0, moving: false, facing, swimming: false, working: false, tool: { id, material: metal, enchanted: lit }, look: look(gender) };
      drawSculptGL(g, cw / 2, ch - 8 * zoom, zoom, lowHoldScene(pose, id, turns[who][id]), { dpr: 1 });
      const box = document.createElement('div'); box.className = 'c'; box.appendChild(cv); row.appendChild(box);
    }
  }
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:13px sans-serif;color:#eee}#root{display:inline-block;padding:4px}.row{display:flex;gap:6px;align-items:flex-end}.c{display:flex;flex-direction:column}.l{padding:2px 2px 6px}.m{width:84px;padding:4px;align-self:center;white-space:pre}.ch{width:auto;min-width:60px;padding:2px}.h{padding:4px 2px;font-weight:600}canvas{display:block}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const shot = async (path) => {
    const r = await p.evaluate(() => { const bb = document.querySelector('#root').getBoundingClientRect(); return { x: bb.x, y: bb.y, width: Math.ceil(bb.width), height: Math.ceil(bb.height) }; });
    await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
    await p.screenshot({ path, clip: r, timeout: 300000 });
    console.log('wrote', path, `${r.width}x${r.height}`);
  };
  if (what.has('swatch')) {
    await p.evaluate(([z, m]) => window.swatch(z, m), [ZOOM, opt('metals', 'copper,iron,bronze,silver,gold,mithril').split(',')]);
    await shot(join(out, 'tools-swatch.png'));
  }
  const SETS = [['hammer', 'copper', false], ['hammer', 'steel', true], ['mallet', undefined, false], ['mallet', undefined, true], ['chisel', 'copper', false], ['chisel', 'silver', true],
    ['hatchet', 'iron', false], ['hatchet', 'gold', true], ['butchering_knife', 'bronze', false], ['butchering_knife', 'mithril', true]];
  const only = opt('sets', '').split(',').filter(Boolean).map(Number);
  if (what.has('held')) for (const z of zooms) {
    await p.evaluate(([zz, tt, ss]) => window.held(zz, tt, ss), [z, TURNS, only.length ? SETS.filter((_, i) => only.includes(i)) : SETS]);
    await shot(join(out, `tools-held-z${z}.png`));
  }
} finally {
  await browser.close();
}
