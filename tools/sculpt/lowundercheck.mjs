// Whether the undergarment (tools/sculpt/lowunder.mjs) shows under the outfits that cover it, in the game's own renderer:
// the bodies drawn by drawFigure (as tools/sculpt/lowundergame.mjs) with the undergarment's material flat magenta, its
// pixels counted in every facing over the walk and the idle, each piece (her band above her waist, the briefs below)
// against what the outfit covers.
//
//   node tools/sculpt/lowundercheck.mjs [--zoom 8] [--frames 8] [--outfits first,plate,...] [--save dir]
//     prints per outfit and body the most pixels of the briefs and of the band seen in any frame, bare first (the
//     reference), and fails (exit 1) where an outfit that covers a piece shows any of it; --save writes each frame of an
//     outfit that covers something where any shows.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const zoom = +opt('zoom', '8'), F = +opt('frames', '8'), save = opt('save', '') && resolve(opt('save', ''));
if (save) mkdirSync(save, { recursive: true });
const NONE = { shawl: false, trousers: false, boots: false, tunic: false, hood: false };
/** Each outfit and what it covers: b the briefs, t the band (her top). */
const OUTFITS = {
  bare: [NONE, ''],
  first: [{}, 'bt'],
  trousers: [{ shawl: false, tunic: false }, 'b'],
  tunic: [{ shawl: false, trousers: false }, 't'],
  leather: [{ ...NONE, leatherLegs: true, leatherBoots: true, leatherShawl: true, leatherHat: true }, 'b'],
  leatherset: [{ ...NONE, leatherChest: true, leatherLegs: true, leatherBoots: true, leatherShawl: true, leatherHat: true }, 'bt'],
  plate: [{ ...NONE, plateChest: true, plateLegs: true, plateBoots: true, plateHelm: true }, 'bt'],
  mantle: [{ ...NONE, plateChest: true, plateLegs: true, plateBoots: true, plateMantle: true }, 'bt'],
};
const outfits = ['bare', ...opt('outfits', Object.keys(OUTFITS).join(',')).split(',').filter((o) => o in OUTFITS && o !== 'bare')];
const ROOT = new URL('../..', import.meta.url).pathname;
// (the undergarment's material made flat magenta: no light, nothing else that colour)
const flat = { name: 'flat-under', setup(b) {
  b.onLoad({ filter: /src\/sculpt\/models\/body\.ts$/ }, (a) => ({ contents: readFileSync(a.path, 'utf8').replace(/out\[M\.under\] = \{[^}]*\};/, "out[M.under] = { colour: '#ff00ff' };"), loader: 'ts' }));
} };
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
import { CLIPS } from './src/sculpt/anim';
const OUTFITS = ${JSON.stringify(Object.fromEntries(Object.entries(OUTFITS).map(([k, [o]]) => [k, o])))};
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' });
window.idleLength = () => CLIPS.idle.length;
/** The magenta pixels' rows (each row's count) in one drawing. */
window.count = (zoom, gender, facing, moving, ph, outfit) => {
  const cw = Math.ceil(44 * zoom) + 30, ch = Math.ceil(48 * zoom) + 24, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
  drawFigure(g, cw / 2, ch - 2 * zoom - 8, zoom, { phase: ph, moving, facing, swimming: false, working: false, look: look(gender), outfit: OUTFITS[outfit] });
  const d = g.getImageData(0, 0, cw, ch).data, rows = new Array(ch).fill(0);
  for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 70 && d[i + 2] > 200) rows[Math.floor(i / 4 / cw)]++;
  return { rows, url: rows.some((n) => n) ? cv.toDataURL('image/png') : '' };
};
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', plugins: [flat], loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0;
try {
  const p = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><body></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  const len = await p.evaluate(() => window.idleLength());
  // the frames: every facing, the walk's stride and the idle's loop, each body played on its own in real time
  const frames = [];
  for (const f of [0, 1, 2, 3, 4]) for (let k = 0; k < F; k++) { frames.push([f, true, (2 * Math.PI * k) / F]); frames.push([f, false, (6 * k * len) / F]); }
  /** Her waist on each bare frame: the middle of the widest run of rows without magenta between the band and the briefs. */
  const waist = {};
  for (const o of outfits) for (const g of ['man', 'woman']) {
    let brief = 0, band = 0;
    for (const [f, mv, ph] of frames) {
      const { rows, url } = await p.evaluate((a) => window.count(...a), [zoom, g, f, mv, ph, o]), key = `${g}${f}${mv}${ph}`;
      if (save && url && OUTFITS[o][1]) writeFileSync(join(save, `${o}-${g}-f${f}-${mv ? 'walk' : 'idle'}-${ph.toFixed(2)}.png`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      if (o === 'bare') {
        let cut = 0;
        if (g === 'woman') { let best = 0, run = 0, last = -1; rows.forEach((n, y) => { if (n) { if (last >= 0 && y - last - 1 > best) { best = y - last - 1; cut = Math.round((y + last) / 2); } last = y; } }); }
        waist[key] = cut;
      }
      const cut = waist[key] ?? 0;
      const up = rows.slice(0, cut).reduce((s, n) => s + n, 0), down = rows.slice(cut).reduce((s, n) => s + n, 0);
      brief = Math.max(brief, down); band = Math.max(band, up);
      await p.waitForTimeout(30);
    }
    const cover = OUTFITS[o][1], bad = (cover.includes('b') && brief > 0) || (cover.includes('t') && band > 0);
    if (bad) failed++;
    console.log(`${o.padEnd(9)} ${g.padEnd(6)} briefs ${String(brief).padStart(5)}${cover.includes('b') ? ' (covered)' : ''}  band ${String(band).padStart(5)}${cover.includes('t') ? ' (covered)' : ''}${bad ? '  SHOWS' : ''}`);
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
