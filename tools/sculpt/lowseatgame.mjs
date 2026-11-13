// Bodies sat driving in the game's own renderer: on the box of a cart or a wagon at the reins, at a rowing boat's oars,
// at a sailing boat's tiller, and astride each mount there is (the orse's three stages, the springlet's, the wadd), the
// piece or the beast drawn as the island draws it (`drawFurniture` with its crew layers; `drawWildermon` tacked) and the
// body on its seat as the renderer puts it there (`driverOn`, `wildermonSaddle`, `wildermonSeat`), through drawFigure
// with the sculpted bodies on (or off, `--flat`, the flat figure the seat was drawn with before).
//
//   node tools/sculpt/lowseatgame.mjs --out <dir> [--scenes cart,wagon,rowing,sailing,orse0,orse1,orse2,springlet,wadd]
//       [--zoom 10] [--angles 0,90,180,270] [--gender man] [--outfit cloth|leather|plate|none] [--weapon long_sword]
//       [--flat] [--moving] [--heel 0] [--pitch 0] [--frames 1] [--step 0.5] [--phase 3] [--name seated]
//     writes <dir>/<name>-<scene>-z<zoom>.png: a row of cells, one a heading (degrees: the piece's way round in the
//     world, 0 along the world's x; a beast's facing times 45), and with --frames n each cell n frames at --step of the phase apart, in a
//     column (for jitter). --heel/--pitch sway the hull as the renderer does (the picture swayed, the seat told of it).
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowseatgame'));
const zoom = +opt('zoom', '10'), name = opt('name', 'seated');
const scenes = opt('scenes', 'cart,wagon,rowing,sailing,orse0,orse1,orse2,springlet,wadd').split(',');
const angles = opt('angles', '0,90,180,270').split(',').map(Number);
const cfg = {
  gender: opt('gender', 'man'), outfit: opt('outfit', 'cloth'), weapon: opt('weapon', 'long_sword'), flat: flag('flat'), moving: flag('moving'),
  heel: +opt('heel', '0'), pitch: +opt('pitch', '0'), frames: +opt('frames', '1'), step: +opt('step', '0.5'), phase: +opt('phase', '3'), hair: opt('hair', ''),
  id: flag('id'), close: flag('close'), tuck: opt('tuck', ''), stand: flag('stand'), sink: +opt('sink', '0'),
};
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import './src/game/actions';
import { drawFigure, sculptedFigures, cartSway, FIGURE_TOP } from './src/render/figure';
import { drawFurniture, driverOn, headingView, helmSeat, crewOrder, swayOnScreen } from './src/render/furniture';
import { kitSync } from './src/render/kitpieces';
import { drawWildermon, loadWildermon, wildermonSaddle, wildermonSeat } from './src/render/wildermon';
import { SPECIES } from './src/game/creatures';
import { HEIGHT_SCALE } from './src/render/iso';
import { DEFAULT_LOOK } from './src/game/look';
const C = ${JSON.stringify(cfg)};
kitSync(true);
const look = { ...DEFAULT_LOOK, gender: C.gender, beard: 'none', ...(C.hair ? { hair: C.hair } : {}) };
const OUTFITS = {
  none: {},
  cloth: { body: { id: 'cloth_tunic' }, legs: { id: 'cloth_trousers' }, feet: { id: 'cloth_shoes' } },
  leather: { body: { id: 'leather_jerkin' }, arms: { id: 'leather_sleeves' }, legs: { id: 'leather_trousers' }, feet: { id: 'leather_boots' }, head: { id: 'leather_cap' } },
  plate: { body: { id: 'plate_breastplate', material: 'iron' }, arms: { id: 'plate_arms', material: 'iron' }, legs: { id: 'plate_legs', material: 'iron' }, feet: { id: 'plate_boots', material: 'iron' }, head: { id: 'helm', material: 'iron' } },
};
const gear = { ...(OUTFITS[C.outfit] ?? {}), ...(C.weapon !== 'none' ? { weapon: { id: C.weapon } } : {}) };
const SADDLE = { hands: 'reins', up: 0, astride: true, grip: [0, 7.5, 2.5] };
const MOUNTS = { orse0: ['orse', 0], orse1: ['orse', 1], orse2: ['orse', 2], springlet: ['springlet', 0], springlet2: ['springlet', 2], wadd: ['wadd', 0] };
const PIECES = { cart: 'large_cart', wagon: 'wagon', rowing: 'rowing_boat', sailing: 'sailing_boat' };
window.ready = async () => {
  if (!C.flat) { sculptedFigures(true); await import('./src/sculpt/sculpted'); }
  for (const [s] of Object.values(MOUNTS)) await loadWildermon(s);
  await new Promise((r) => setTimeout(r, 100));
};
const figure = (g, x, y, facing, seat, phase) => drawFigure(g, x, y, ${zoom}, { phase, moving: C.moving, facing, swimming: false, working: false, driving: !C.stand, seat: C.stand ? undefined : seat, look, gear, ...(C.id ? { id: 'seat-test' } : {}) });
window.cell = (scene, angle, phase) => {
  const zoom = ${zoom}, cw = Math.ceil(90 * zoom) + 40, ch = Math.ceil(90 * zoom) + 40;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = PIECES[scene] && /boat/.test(PIECES[scene]) ? '#4f7f9a' : '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  const sx = cw / 2, sy = ch * 0.68;
  const a = (angle * Math.PI) / 180;
  if (PIECES[scene]) {
    const kind = PIECES[scene], view = headingView(a, 0), d = driverOn(kind, view);
    const sway = (C.heel || C.pitch) ? { heel: C.heel, pitch: C.pitch, lift: 0 } : null;
    if (C.sink) d.seat = { ...d.seat, up: d.seat.up - C.sink };
    const seat = sway || d.seat.pivot ? { ...d.seat, sway: sway ? { heel: sway.heel, pitch: sway.pitch } : undefined, wood: d.seat.pivot ? '#8a5a32' : undefined } : d.seat;
    g.save();
    if (sway) { const w = swayOnScreen(view, sway, zoom); g.translate(sx, sy - w.up); g.transform(w.a, w.b, w.c, w.d, 0, 0); g.translate(-sx, -sy); }
    const sat = helmSeat(kind), crew = sat ? { tall: FIGURE_TOP / HEIGHT_SCALE, at: [sat] } : undefined;
    const fx = sx + d.dx * zoom, fy = sy + d.dy * zoom;
    if (crew) {
      const order = crewOrder(zoom, kind, false, undefined, undefined, view, 'pine', crew, true);
      drawFurniture(g, sx, sy, zoom, kind, false, undefined, undefined, view, 'pine', crew, 0, true, null, true);
      order.forEach((spot, n) => { figure(g, fx, fy, d.facing, seat, phase); drawFurniture(g, sx, sy, zoom, kind, false, undefined, undefined, view, 'pine', crew, n + 1, true, null, true); });
    } else {
      drawFurniture(g, sx, sy, zoom, kind, false, undefined, undefined, view, 'pine', undefined, 'all', true, null, true);
      figure(g, fx, fy, d.facing, seat, phase);
    }
    g.restore();
    g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(scene + ' ' + angle + ' f' + d.facing.toFixed(2), 6, 16);
    if (C.close) return closeUp(cv, fx, fy, scene + ' ' + angle);
  } else {
    const [species, stage] = MOUNTS[scene];
    // the beast's facing, one of the eight: the heading over 45
    const facing = ((Math.round(angle / 45) % 8) + 8) % 8;
    drawWildermon(g, sx, sy, zoom, species, SPECIES[species]?.colors ?? ['#a87', '#654'], { facing, phase: 0, moving: false }, stage, true);
    const own = wildermonSaddle(species, stage), up = wildermonSeat(species, stage) ?? SPECIES[species]?.mount ?? 0;
    // (one whose model says nothing: drawn up as far as its back is low, as src/render/renderer.ts saddleTuck)
    const seat = own ? { ...SADDLE, grip: own.grip, tuck: own.tuck } : { ...SADDLE, tuck: Math.max(0, Math.min(1, (9 - up / HEIGHT_SCALE) / 4)) };
    if (C.tuck !== '') seat.tuck = +C.tuck;
    figure(g, sx, sy - up * zoom, facing, seat, phase);
    g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(scene + ' f' + facing + ' tuck ' + (seat.tuck ?? 0), 6, 16);
    if (C.close) return closeUp(cv, sx, sy - up * zoom, scene + ' f' + facing);
  }
  return cv;
};
// (--close: the cell cut to the body, its feet at the middle of the bottom quarter)
const closeUp = (cv, x, y, label) => {
  const z = ${zoom}, w = Math.round(44 * z), h = Math.round(50 * z), o = document.createElement('canvas'); o.width = w; o.height = h;
  const g = o.getContext('2d'); g.drawImage(cv, Math.round(x - w / 2), Math.round(y - h * 0.68), w, h, 0, 0, w, h);
  g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(label, 6, 16);
  return o;
};
window.show = (scene, angles, frames, phase, step) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  for (const an of angles) {
    const col = document.createElement('div'); col.style.display = 'flex'; col.style.flexDirection = 'column';
    for (let k = 0; k < frames; k++) col.appendChild(window.cell(scene, an, phase + k * step));
    root.appendChild(col);
  }
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.text()); });
  await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b}#root{display:inline-flex;gap:2px}canvas{display:block;margin-bottom:2px}</style></head><body><div id=root></div></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const shot = async (sel, path) => {
    const r = await p.evaluate((q) => { const b = document.querySelector(q).getBoundingClientRect(); return { x: b.x, y: b.y, width: Math.ceil(b.width), height: Math.ceil(b.height) }; }, sel);
    await p.setViewportSize({ width: Math.max(1200, Math.ceil(r.x + r.width)), height: Math.max(800, Math.ceil(r.y + r.height)) });
    await p.screenshot({ path, clip: r, timeout: 300000 });
  };
  for (const s of scenes) {
    // twice: the first draw asks for what loads (a kit piece's bake, a beast's line), the second has it
    await p.evaluate(([sc, an, fr, ph, st]) => window.show(sc, an, fr, ph, st), [s, angles, cfg.frames, cfg.phase, cfg.step]);
    await p.waitForTimeout(300);
    await p.evaluate(([sc, an, fr, ph, st]) => window.show(sc, an, fr, ph, st), [s, angles, cfg.frames, cfg.phase, cfg.step]);
    const f = join(out, `${name}-${s}-z${zoom}.png`);
    await shot('#root', f);
    console.log('wrote', f);
  }
} finally {
  await browser.close();
}
