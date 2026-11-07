// The low-poly male (src/sculpt/lowpoly.ts) walking in the game's own renderer: drawFigure with the "Sculpted figures"
// switch on, as the island draws a body, through the WebGL2 skinning path (src/sculpt/gl.ts). Eight phases of the
// game's walk front (facing 0), three-quarter (1) and side (2), and the idle, into a sheet and a looping GIF.
//
//   node tools/sculpt/lowwalk.mjs --out <dir> [--zoom 5.5]     # writes <dir>/walk-ingame.png, walk-ingame.gif
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL; the GIF needs Python's PIL.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowwalk'));
const zoom = +opt('zoom', '5.5'), cw = 220, ch = 420;
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
const look = { ...DEFAULT_LOOK, gender: 'man', hair: 'bald', beard: 'none' };
window.run = async (zoom, cw, ch) => {
  sculptedFigures(true);
  await import('./src/sculpt/sculpted');
  await new Promise((r) => setTimeout(r, 50));
  const root = document.getElementById('root');
  const rows = [['walk, front (facing 0)', 0, true], ['walk, three-quarter (facing 1)', 1, true], ['walk, side (facing 2)', 2, true], ['idle, front', 0, false]];
  for (const [lab, facing, moving] of rows) {
    const h = document.createElement('div'); h.className = 'h'; h.textContent = lab; root.appendChild(h);
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (let k = 0; k < 8; k++) {
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; row.appendChild(cv);
      const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
      drawFigure(g, cw / 2, ch - 30, zoom, { phase: moving ? (k / 8) * Math.PI * 2 : k * 0.75, moving, facing, swimming: false, working: false, look });
    }
  }
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: cw * 8, height: 4 * (ch + 23) }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:13px sans-serif;color:#eee}.row{display:flex}.h{height:19px;padding:2px 6px}canvas{display:block}</style></head><body><div id=root></div></body></html>');
await p.addScriptTag({ content: b.outputFiles[0].text });
await p.evaluate(([z, a, c]) => window.run(z, a, c), [zoom, cw, ch]);
const raw = join(out, 'walk-raw.png');
await p.screenshot({ path: raw, fullPage: true });
await browser.close();
// the sheet: front and side rows; the GIF: front, three-quarter and side side by side, eight frames
execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
im = Image.open(sys.argv[1]).convert('RGB'); cw, ch, hh, z = ${cw}, ${ch}, 23, sys.argv[3]
cells = lambda r: [im.crop((k * cw, hh + r * (ch + hh), (k + 1) * cw, hh + r * (ch + hh) + ch)) for k in range(8)]
F, Q, S = cells(0), cells(1), cells(2)
o = Image.new('RGB', (cw * 8, 2 * ch + 52), (47, 41, 43)); d = ImageDraw.Draw(o)
d.text((6, 4), "Low-poly male in the game's renderer (drawFigure, Sculpted figures on, src/sculpt/lowpoly.ts on the GPU skinning path): the game's walk, 8 phases, zoom " + z, fill=(240, 230, 220))
d.text((6, 18), 'front (facing 0)', fill=(240, 230, 220)); d.text((6, ch + 36), 'side (facing 2)', fill=(240, 230, 220))
for k in range(8): o.paste(F[k], (k * cw, 32)); o.paste(S[k], (k * cw, ch + 52))
o.save(sys.argv[2] + '/walk-ingame.png')
fr = []
for k in range(8):
  f = Image.new('RGB', (cw * 3, ch)); f.paste(F[k], (0, 0)); f.paste(Q[k], (cw, 0)); f.paste(S[k], (2 * cw, 0)); fr.append(f.resize((cw * 2, ch * 2 // 3)))
fr[0].save(sys.argv[2] + '/walk-ingame.gif', save_all=True, append_images=fr[1:], duration=110, loop=0)
`, raw, out, String(zoom)]);
console.log('wrote', join(out, 'walk-ingame.png'), join(out, 'walk-ingame.gif'));
