// The awl, the carving knife, the trowel, the file and the whetstone (tools/sculpt/gear/finetools.mjs) in the game's own
// renderer (drawSculptGL, the sculpted figures on).
//
//   node tools/sculpt/lowtoolsbgame.mjs --out <dir> [--what swatch,held] [--zoom 9] [--zooms 3,8]
//     swatch: <dir>/tools-b-swatch.png, each tool alone (lowPropDraw) in five metals and in none, plain and enchanted;
//     held: <dir>/tools-b-held-z<zoom>.png, each tool in the right fist of both bodies (lowToolStill), the right arm raised
//       to a work pose in front of the body (lowgear.mjs reach: the fist at bench height, the tool's working end forward
//       and over toward the body's left, the blow's way down), front, three-quarter, side and back.
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { reach, cols } from './lowgear.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowtoolsbgame'));
const what = new Set(opt('what', 'swatch,held').split(','));
const ZOOM = +opt('zoom', '9');
const zooms = opt('zooms', '3,8').split(',').map(Number).filter((z) => z > 0);
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const IDS = ['awl', 'carving_knife', 'trowel', 'file', 'whetstone'];
const NAMES = { awl: 'Awl', carving_knife: 'Carving knife', trowel: 'Trowel', file: 'File', whetstone: 'Whetstone' };
const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * The right arm's turns for the work pose on a body, per tool (its own socket): the fist forward of the chest, raised to
 * strike; the blow's way (the socket's x) forward and down, the tool (its y) up and a little over toward the body's left.
 */
function workTurns(who, id) {
  const rig = buildRig(who), A = JSON.parse(readFileSync(join(ROOT, `src/sculpt/assets/${id}.json`), 'utf8'));
  const so = A.sockets[who].r, s = { side: 'r', o: so.o, R: so.R, bone: rig.at.get(so.bone) };
  const sh = rig.bones[rig.at.get('upperarm_r')].head, top = Math.max(...rig.B.verts.map((p) => p[1])), H = top - rig.J.floor;
  // the fist four fifths of the arm's length (shoulder to wrist) out from the shoulder: forward and down to the chest's foot
  const b = (n) => rig.bones[rig.at.get(n)].head, len = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
  const arm = len(b('lowerarm_r'), sh) + len(b('hand_r'), b('lowerarm_r')), dir = unit([-0.05, -0.5, 0.86]), o = [0, 1, 2].map((k) => sh[k] + dir[k] * 0.8 * arm);
  const x = unit([0.1, -0.35, 0.93]), y0 = unit([0.3, 0.9, 0.3]), y = unit(y0.map((v, k) => v - x[k] * (y0[0] * x[0] + y0[1] * x[1] + y0[2] * x[2]))), z = crossV(x, y);
  // from the rest and from the elbow bent, the better kept
  const r = [{}, { upperarm_r: [20, -20, 12], lowerarm_r: [60, 0, 0], hand_r: [40, 55, 25] }].map((st) => reach(rig, st, s, { o, R: cols(x, y, z) }, { elbowOut: 0.05 * H })).sort((p, q) => p.cost - q.cost)[0];
  const turns = Object.fromEntries(['upperarm_r', 'lowerarm_r', 'hand_r'].map((b) => [b, (r.pose[b] ?? [0, 0, 0]).map((v) => +v.toFixed(2))]));
  return { turns, err: r.err };
}

const entry = `
import { sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
import { lowPropDraw, lowToolStill } from './src/sculpt/lowpoly';
import { drawSculptGL } from './src/sculpt/gl';
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' });
const BG = '#7d9b5e';
const lab = (t, cls = 'l') => { const d = document.createElement('div'); d.className = cls; d.textContent = t; return d; };
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
function crop(cv, pad, bg) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height, px = g.getImageData(0, 0, w, h).data;
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < x0) { x0 = 0; y0 = 0; x1 = 1; y1 = 1; }
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1 + pad * 2; o.height = y1 - y0 + 1 + pad * 2;
  const og = o.getContext('2d'); og.fillStyle = bg; og.fillRect(0, 0, o.width, o.height);
  og.drawImage(cv, x0, y0, x1 - x0 + 1, y1 - y0 + 1, pad, pad, x1 - x0 + 1, y1 - y0 + 1);
  return o;
}
function propCell(id, piece, yaw, zoom) {
  const d = lowPropDraw(id, piece, yaw), w = Math.ceil(16 * zoom), h = Math.ceil(26 * zoom);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  drawSculptGL(cv.getContext('2d'), w / 2, h - 4 * zoom, zoom, d, { dpr: 1 });
  return crop(cv, 6, BG);
}
window.swatch = (zoom, ids, names, metals) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('The hand tools alone in the game renderer (lowPropDraw), zoom ' + zoom + ': plain | enchanted, by the item\\'s metal (none: no metal on the item)', 'h'));
  for (const id of ids) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    row.appendChild(lab(names[id], 'm'));
    for (const metal of metals) for (const lit of [false, true]) {
      const box = document.createElement('div'); box.className = 'c';
      box.appendChild(propCell(id, { id, material: metal ?? undefined, enchanted: lit }, 200, zoom));
      box.appendChild(lab((metal ?? 'none') + (lit ? ' ench' : '')));
      row.appendChild(box);
    }
  }
};
const VIEWS = [[0, 'front'], [1, '3/4'], [2, 'side'], [7, '3/4 r'], [4, 'back']];
window.held = (zoom, ids, names, turns, sets) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  root.appendChild(lab('Each tool in the right fist (lowToolStill: the idle, the right arm raised to strike), the game renderer, zoom ' + zoom, 'h'));
  for (const gender of ['man', 'woman']) for (const id of ids) {
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    const [metal, lit] = sets[id];
    for (const [facing, v] of VIEWS) {
      const cw = Math.ceil(56 * zoom), ch = Math.ceil(80 * zoom), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const g = cv.getContext('2d'); g.fillStyle = BG; g.fillRect(0, 0, cw, ch);
      const pose = { phase: 0, moving: false, facing, swimming: false, working: false, look: look(gender), tool: { id, material: metal ?? undefined, enchanted: lit } };
      const d = lowToolStill(pose, id, turns[gender === 'woman' ? 'female' : 'male'][id]);
      drawSculptGL(g, cw / 2, ch - 12 * zoom, zoom, d, { dpr: 1 });
      const box = document.createElement('div'); box.className = 'c'; box.appendChild(cv);
      box.appendChild(lab(gender + ' ' + names[id] + ' ' + (metal ?? '') + (lit ? ' ench' : '') + ' ' + v)); row.appendChild(box);
    }
  }
};`;

const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:12px sans-serif;color:#eee}#root{display:inline-block;padding:4px;width:max-content}.row{display:flex;gap:5px;align-items:flex-end}.c{display:flex;flex-direction:column;flex:none}.l{padding:2px 2px 6px}.m{width:90px;padding:4px;align-self:center}.h{padding:4px 2px;font-weight:600}canvas{display:block;align-self:center}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const shot = async (path) => {
    const r = await p.evaluate(() => { const bb = document.querySelector('#root').getBoundingClientRect(); return { x: bb.x, y: bb.y, width: Math.ceil(bb.width), height: Math.ceil(bb.height) }; });
    await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
    await p.screenshot({ path, clip: r, timeout: 300000 });
    console.log('wrote', path, `${r.width}x${r.height}`);
  };
  if (what.has('swatch')) {
    await p.evaluate(([z, ids, names, metals]) => window.swatch(z, ids, names, metals), [ZOOM, IDS, NAMES, ['copper', 'iron', 'steel', 'gold', 'adamantine', null]]);
    await shot(join(out, 'tools-b-swatch.png'));
  }
  if (what.has('held')) {
    const turns = { male: {}, female: {} };
    for (const who of ['male', 'female']) for (const id of IDS) { const t = workTurns(who, id); turns[who][id] = t.turns; console.log(who, id, JSON.stringify(t.turns), 'err', t.err.pos.toFixed(3), t.err.ang.map((a) => a.toFixed(0)).join('/')); }
    const SETS = { awl: [null, false], carving_knife: ['copper', false], trowel: ['iron', true], file: ['steel', false], whetstone: [null, true] };
    for (const z of zooms) {
      await p.evaluate(([zz, ids, names, tt, ss]) => window.held(zz, ids, names, tt, ss), [z, IDS, NAMES, turns, SETS]);
      await shot(join(out, `tools-b-held-z${z}.png`));
    }
  }
} finally {
  await browser.close();
}
