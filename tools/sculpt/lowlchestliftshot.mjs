// The lifted leather chest (lowlchestlift.mjs) on the body at rest, from the sheet's five angles, each face in the
// sheet's own colour there, beside the sheet's view.
//   node tools/sculpt/lowlchestliftshot.mjs <lift dir> <out.png> [--who male] [--edges]
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, SKIN } from './lowgarmentshot.mjs';
const args = process.argv.slice(2), [dir, outp] = args, opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const who = opt('who', 'male'), rig = buildRig(who), L = JSON.parse(readFileSync(join(dir, `lift-${who}.json`), 'utf8'));
// (--only <regex>: the pieces drawn)
if (opt('only', null)) { const re = new RegExp(opt('only')); L.faces = L.faces.filter((f) => re.test(f.piece ?? '')); }
const SHEET = new URL('./ref/leather-chest.png', import.meta.url).pathname;
const CROPS = { male: [[18, 98, 210, 250], [222, 98, 166, 250], [388, 98, 102, 250], [488, 98, 168, 250], [654, 98, 176, 250]], female: [[18, 432, 210, 230], [222, 432, 166, 230], [388, 432, 102, 230], [488, 432, 168, 230], [654, 432, 176, 230]] };
const YAW = [0, -40, -90, -140, 180], cw = 300, ch = 380, cells = [], imgs = [];
const body = { who, P: rig.B.verts, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : [0.22, 0.15, 0.13])) };
const arm = { who, P: L.verts, polys: L.faces.map((f) => f.v), tris: L.faces.flatMap((f, i) => f.v.slice(1, -1).map((_, k) => [f.v[0], f.v[k + 1], f.v[k + 2], i])), col: L.faces.map((f) => (args.includes('--debug') ? (() => { let h = 0; for (const ch of (f.piece ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return [((h & 255) / 255) * 0.8 + 0.2, (((h >> 8) & 255) / 255) * 0.8 + 0.2, (((h >> 16) & 255) / 255) * 0.8 + 0.2].map((x, i) => x * (f.col[0] < 60 ? 0.5 : 1)); })() : f.col.map((x) => x / 255))), edges: args.includes('--edges'), edgec: [0.1, 0.06, 0.05] };
const cy = who === 'male' ? -2.6 : -2.3;
YAW.forEach((yaw, i) => {
  const [x, y, w, h] = CROPS[who][i];
  imgs.push({ src: SHEET, size: [1536, 1024], crop: [x, y, w, h], box: [i * cw, 30, cw, ch] });
  cells.push({ meshes: [body, arm], cam: { yaw, pitch: 0, s: 52, c: [0, cy, 0] }, box: [i * cw, 30 + ch, cw, ch], label: `${who} ${yaw}°` });
});
await shoot(5 * cw, 30 + 2 * ch, cells, resolve(outp), { imgs, texts: [{ css: 'left:10px;top:4px', html: 'The leather chest lifted from the approved trace: the sheet above, the model below (each face the sheet\'s colour)' }] });
await closeBrowser();
