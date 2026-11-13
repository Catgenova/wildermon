// Bodies in the water in the game's own renderer: swimming under way and treading water, as the island draws them
// (drawFigure with the sculpted bodies on, cut at the water's surface; or off, `--flat`, the flat figure), on open water.
//
//   node tools/sculpt/lowswimgame.mjs --out <dir> [--mode game|compare|strip|keys|transition] [--zoom 6]
//       [--facings 0,1,2,3,4,5,6,7] [--genders man,woman] [--outfit cloth|leather|plate|chain|scale|none] [--hair <style>]
//       [--weapon none|long_sword|...] [--states swim,tread] [--frames 8] [--name swim]
//
// writes <dir>/<name>.png:
//   game        a row a body and state, a cell a facing, at --u of a run (0.37: swimming, the breath)
//   compare     as game, each cell the sculpted body beside the flat figure at the same place
//   strip       a run of each state in --frames steps (swimming a stroke, treading a sweep), a row a body, state and facing
//               (--both: each row again as the flat figure under it; --range a,b: frames a to b-1 only)
//   keys        the clips' key poses (Clip.poses) on dry land, uncut and lifted out of the water by as far as the clip lets
//               the body down, the surface a blue line across, a row a pose
//   transition  walked in, swum, stopped to tread water and set off again, as the game fades one into the next (a body
//               drawn frame after frame), frames 0.1 s apart
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowswimgame'));
const cfg = {
  mode: opt('mode', 'game'), zoom: +opt('zoom', '6'), facings: opt('facings', '0,1,2,3,4,5,6,7').split(',').map(Number),
  genders: opt('genders', 'man,woman').split(','), outfit: opt('outfit', 'cloth'), hair: opt('hair', ''), weapon: opt('weapon', 'none'),
  states: opt('states', 'swim,tread').split(','), frames: +opt('frames', '8'), name: opt('name', 'swim'), flat: args.includes('--flat'), both: args.includes('--both'),
  phase: +opt('u', '0.37'), range: opt('range', '').split(',').filter(Boolean).map(Number),
};
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import './src/game/actions';
import { drawFigure, sculptedFigures, SWIM_STROKE, TREAD_RATE, FIGURE_TOP } from './src/render/figure';
import { HEIGHT_SCALE } from './src/render/iso';
import { kitSync } from './src/render/kitpieces';
import { DEFAULT_LOOK } from './src/game/look';
import { CLIPS } from './src/sculpt/anim';
import { lowScene } from './src/sculpt/lowpoly';
import { drawSculptGL } from './src/sculpt/gl';
const C = ${JSON.stringify(cfg)};
kitSync(true);
const OUTFITS = {
  none: {},
  cloth: { chest: { id: 'cloth_tunic' }, legs: { id: 'cloth_trousers' }, feet: { id: 'cloth_shoes' } },
  leather: { chest: { id: 'leather_jerkin' }, shawl: { id: 'leather_shawl' }, legs: { id: 'leather_trousers' }, feet: { id: 'leather_boots' }, head: { id: 'leather_cap' } },
  chain: { chest: { id: 'chain_hauberk', material: 'iron' }, shawl: { id: 'chain_shawl', material: 'iron' }, legs: { id: 'chain_leggings', material: 'iron' }, feet: { id: 'chain_boots', material: 'iron' }, head: { id: 'chain_coif', material: 'iron' } },
  scale: { chest: { id: 'scale_cuirass' }, shawl: { id: 'scale_shawl' }, legs: { id: 'scale_leggings' }, feet: { id: 'scale_boots' }, head: { id: 'scale_helm' } },
  plate: { chest: { id: 'plate_breastplate', material: 'iron' }, shawl: { id: 'plate_shawl', material: 'iron' }, legs: { id: 'plate_legs', material: 'iron' }, feet: { id: 'plate_boots', material: 'iron' }, head: { id: 'helm', material: 'iron' } },
};
const gear = { ...(OUTFITS[C.outfit] ?? {}), ...(C.weapon !== 'none' ? { weapon: { id: C.weapon } } : {}) };
const lookOf = (gender) => ({ ...DEFAULT_LOOK, gender, beard: 'none', ...(C.hair ? { hair: C.hair } : {}) });
const poseOf = (gender, state, facing, phase, extra = {}) => ({ phase, moving: state === 'swim' || state === 'walk', gait: 0, facing, swimming: state !== 'walk', working: false, look: lookOf(gender), gear, ...extra });
/** The phase a share u of a run is at: a stroke of the walk's phase swimming, a sweep of the island's clock treading water. */
const phaseAt = (state, u) => (state === 'swim' ? u * SWIM_STROKE : (u * Math.PI * 2) / TREAD_RATE);
// the clock fades are timed by, set by the transition
let CLOCK = null;
const realNow = performance.now.bind(performance);
performance.now = () => CLOCK ?? realNow();
window.ready = async () => { sculptedFigures(!C.flat); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 100)); };
const WATER = '#4f7f9a', LAND = '#7d9b5e';
const label = (g, text) => { g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(text, 4, 13); };
/** One cell: a body in the water at its middle, sculpted or flat. */
const cell = (w, h, draw, text, ground = WATER, at = 0.62) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.fillStyle = ground; g.fillRect(0, 0, w, h);
  // the water's line through the feet, where the island draws a swimmer
  draw(g, w / 2, h * at);
  label(g, text);
  return cv;
};
const body = (flat, pose) => (g, x, y) => { sculptedFigures(!flat); drawFigure(g, x, y, C.zoom, pose); };
const row = (cells, title) => {
  const r = document.createElement('div'); r.className = 'row';
  if (title) { const t = document.createElement('div'); t.className = 't'; t.textContent = title; document.getElementById('root').appendChild(t); }
  for (const c of cells) r.appendChild(c);
  document.getElementById('root').appendChild(r);
};
const W = () => Math.ceil(30 * C.zoom), H = () => Math.ceil(34 * C.zoom);
let RUN = 0;
window.show = () => {
  RUN++;
  const root = document.getElementById('root'); root.innerHTML = '';
  const z = C.zoom;
  if (C.mode === 'game' || C.mode === 'compare') {
    for (const gender of C.genders) for (const state of C.states) {
      const cells = [];
      for (const f of C.facings) {
        const pose = poseOf(gender, state, f, phaseAt(state, C.phase));
        cells.push(cell(W(), H(), body(C.flat, pose), gender + ' ' + state + ' f' + f + (C.flat ? ' flat' : '')));
        if (C.mode === 'compare') cells.push(cell(W(), H(), body(true, pose), 'flat'));
      }
      row(cells);
    }
  } else if (C.mode === 'strip') {
    for (const gender of C.genders) for (const state of C.states) for (const f of C.facings) for (const flat of C.both ? [false, true] : [C.flat]) {
      const cells = [];
      for (let k = C.range[0] ?? 0; k < (C.range[1] ?? C.frames); k++) {
        const u = k / C.frames, pose = poseOf(gender, state, f, phaseAt(state, u));
        cells.push(cell(W(), H(), body(flat, pose), gender + ' ' + state + ' f' + f + ' ' + u.toFixed(3) + (flat ? ' flat' : '')));
      }
      row(cells);
    }
  } else if (C.mode === 'keys') {
    // the clip's key poses, uncut, lifted out of the water by as far as the clip lets the body down into it
    for (const state of C.states) {
      const clip = CLIPS[state];
      for (const p of clip.poses) {
        const cells = [];
        for (const gender of C.genders) for (const f of C.facings) {
          const pose = poseOf(gender, state, f, phaseAt(state, p.t / clip.length + 1e-4));
          cells.push(cell(W(), Math.ceil(74 * z), (g, x, y) => {
            const d = lowScene(pose); delete d.water;
            // lifted back up by as far as the clip lets it down (its tallest at about the figure's top), the surface a line
            const lift = -clip.move[0].v[1] * (FIGURE_TOP / HEIGHT_SCALE) * 0.92;
            for (let i = 0; i < d.bones.length; i += 12) d.bones[i + 11] += lift;
            drawSculptGL(g, x, y + 8 * z, z, d, { dpr: 1 });
            g.strokeStyle = 'rgba(80,140,220,0.9)'; g.beginPath();
            const wy = y + 8 * z - lift * HEIGHT_SCALE * z;
            g.moveTo(0, wy); g.lineTo(W(), wy); g.stroke();
          }, gender + ' ' + state + ' ' + p.name + ' f' + f, LAND, 0.74));
        }
        row(cells, state + ': ' + p.name + ' (t ' + p.t + 's)');
      }
    }
  } else if (C.mode === 'transition') {
    // walked into the water: walking 0-1 s, swimming 1-3 s, treading water 3-5 s, swimming again 5-6 s
    for (const gender of C.genders) for (const f of C.facings) {
      const cells = [];
      let walked = 0;
      for (let k = 0; k <= 60; k++) {
        const s = k / 10, state = s < 1 ? 'walk' : s < 3 ? 'swim' : s < 5 ? 'tread' : 'swim';
        if (state !== 'tread') walked += 0.7;
        CLOCK = s * 1000;
        const pose = poseOf(gender, state, f, state === 'tread' ? s * 6 : walked, { id: gender + '-tr-' + f + '-' + RUN });
        cells.push(cell(W(), Math.ceil(56 * z), body(C.flat, pose), gender + ' ' + state + ' ' + s.toFixed(1) + 's', state === 'walk' ? LAND : WATER));
        CLOCK = null;
      }
      for (let i = 0; i < cells.length; i += 12) row(cells.slice(i, i + 12));
    }
  }
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.text()); });
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;color:#eee;font:13px sans-serif}#root{display:inline-block}.row{display:flex;gap:2px;margin-bottom:2px}.t{padding:4px}canvas{display:block}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  // twice: the first draw asks for what loads, the second has it
  await p.evaluate(() => window.show());
  await p.waitForTimeout(200);
  await p.evaluate(() => window.show());
  const r = await p.evaluate(() => { const b = document.getElementById('root').getBoundingClientRect(); return { x: b.x, y: b.y, width: Math.ceil(b.width), height: Math.ceil(b.height) }; });
  await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
  const f = join(out, `${cfg.name}.png`);
  await p.screenshot({ path: f, clip: r, timeout: 300000 });
  console.log('wrote', f);
} finally {
  await browser.close();
}
