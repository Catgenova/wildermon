// The low-poly male and female (src/sculpt/lowpoly.ts) walking in the game's own renderer: drawFigure with the
// "Sculpted figures" switch on, as the island draws a body, through the WebGL2 skinning path (src/sculpt/gl.ts). Eight
// phases of the game's walk front (facing 0), three-quarter (1) and side (2), and the idle, into a sheet and a looping GIF.
//
//   node tools/sculpt/lowwalk.mjs --out <dir> [--who male|female|both] [--zoom 5.5]
//     writes <dir>/walk-<who>.png and walk-<who>.gif (both: the man and the woman side by side in each picture), and
//     walk-raw-<who>.png: every row (walk front, three-quarter, side; idle front, three-quarter), each picture's cell
//     34 x 46 figure units a body at the zoom (no smaller than 110 x 150 px) plus 40 px; prints the median and worst ms
//     of a body's draw
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL; the GIF needs Python's PIL.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowwalk'));
const who = opt('who', 'male'), genders = who === 'both' ? ['man', 'woman'] : [who === 'female' ? 'woman' : 'man'];
const zoom = +opt('zoom', '5.5'), cw = Math.ceil(Math.max(110, 34 * zoom)) * genders.length, ch = Math.ceil(Math.max(150, 46 * zoom) + 40);
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
window.run = async (zoom, cw, ch, genders) => {
  const looks = genders.map((gender) => ({ ...DEFAULT_LOOK, gender, hair: 'bald', beard: 'none' }));
  sculptedFigures(true);
  await import('./src/sculpt/sculpted');
  await new Promise((r) => setTimeout(r, 50));
  const root = document.getElementById('root');
  const rows = [['walk, front (facing 0)', 0, true], ['walk, three-quarter (facing 1)', 1, true], ['walk, side (facing 2)', 2, true], ['idle, front', 0, false], ['idle, three-quarter', 1, false]];
  const ms = [];
  for (const [lab, facing, moving] of rows) {
    const h = document.createElement('div'); h.className = 'h'; h.textContent = lab; root.appendChild(h);
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    for (let k = 0; k < 8; k++) {
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; row.appendChild(cv);
      const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cw, ch);
      looks.forEach((look, j) => {
        const t0 = performance.now();
        drawFigure(g, (cw * (j + 0.5)) / looks.length, ch - 30, zoom, { phase: moving ? (k / 8) * Math.PI * 2 : k * 0.75, moving, facing, swimming: false, working: false, look });
        ms.push(performance.now() - t0);
      });
    }
  }
  ms.sort((a, b) => a - b);
  return [ms[ms.length >> 1], ms[ms.length - 1]];
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: cw * 8, height: 5 * (ch + 23) }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.setContent('<!doctype html><html><head><style>body{margin:0;background:#2f292b;font:13px sans-serif;color:#eee}.row{display:flex}.h{height:19px;padding:2px 6px}canvas{display:block}</style></head><body><div id=root></div></body></html>');
await p.addScriptTag({ content: b.outputFiles[0].text });
const [med, worst] = await p.evaluate(([z, a, c, gs]) => window.run(z, a, c, gs), [zoom, cw, ch, genders]);
console.log(`a body's draw at zoom ${zoom}: median ${med.toFixed(1)} ms, worst ${worst.toFixed(1)} ms (software GL)`);
// the rows read off their canvases into one picture as the page lays them out (a screenshot of a page this big times out)
const raw = join(out, `walk-raw-${who}.png`);
const url = await p.evaluate(([a, c]) => {
  const rows = [...document.querySelectorAll('.row')], o = document.createElement('canvas');
  o.width = a * 8; o.height = rows.length * (c + 23);
  const g = o.getContext('2d'); g.fillStyle = '#2f292b'; g.fillRect(0, 0, o.width, o.height);
  g.fillStyle = '#eee'; g.font = '13px sans-serif';
  rows.forEach((r, i) => { g.fillText(r.previousElementSibling.textContent, 6, i * (c + 23) + 15); [...r.children].forEach((cv, k) => g.drawImage(cv, k * a, i * (c + 23) + 23)); });
  return o.toDataURL('image/png');
}, [cw, ch]);
writeFileSync(raw, Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
// the sheet: front and side rows; the GIF: front, three-quarter and side side by side, eight frames
execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
im = Image.open(sys.argv[1]).convert('RGB'); cw, ch, hh, z = ${cw}, ${ch}, 23, sys.argv[3]
cells = lambda r: [im.crop((k * cw, hh + r * (ch + hh), (k + 1) * cw, hh + r * (ch + hh) + ch)) for k in range(8)]
F, Q, S = cells(0), cells(1), cells(2)
o = Image.new('RGB', (cw * 8, 2 * ch + 52), (47, 41, 43)); d = ImageDraw.Draw(o)
d.text((6, 4), sys.argv[4] + " in the game's renderer (drawFigure, Sculpted figures on, src/sculpt/lowpoly.ts on the GPU skinning path): the game's walk, 8 phases, zoom " + z, fill=(240, 230, 220))
d.text((6, 18), 'front (facing 0)', fill=(240, 230, 220)); d.text((6, ch + 36), 'side (facing 2)', fill=(240, 230, 220))
for k in range(8): o.paste(F[k], (k * cw, 32)); o.paste(S[k], (k * cw, ch + 52))
o.save(sys.argv[2] + '/walk-' + sys.argv[5] + '.png')
fr = []
for k in range(8):
  f = Image.new('RGB', (cw * 3, ch)); f.paste(F[k], (0, 0)); f.paste(Q[k], (cw, 0)); f.paste(S[k], (2 * cw, 0)); fr.append(f.resize((cw * 2, ch * 2 // 3)))
fr[0].save(sys.argv[2] + '/walk-' + sys.argv[5] + '.gif', save_all=True, append_images=fr[1:], duration=110, loop=0)
`, raw, out, String(zoom), { male: 'Low-poly male', female: 'Low-poly female', both: 'Low-poly male and female' }[who], who]);
console.log('wrote', join(out, `walk-${who}.png`), join(out, `walk-${who}.gif`));
