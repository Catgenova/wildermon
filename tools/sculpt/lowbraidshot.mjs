// The side braid's review sheets (tools/sculpt/lowbraid.mjs on the low-poly bodies), drawn by tools/sculpt/lowhairshot.mjs
// shoot: per view the reference sheet's row (tools/sculpt/ref/hair-side-braid.png), ours under that view's camera
// (tools/sculpt/hairs/braid-cams.json), and ours over the sheet in a see-through teal, with the outline difference
// (tools/sculpt/lowbraid.mjs outlineDiff) per view.
//
//   node tools/sculpt/lowbraidshot.mjs --out <dir> [--tag -x] [--who female,male]
//        [--only cams,hull,views,close,turn,wire,sil,exploded,game,shawl]
// cams: the cameras' registration (her head and neck over the sheet's skin and hair silhouettes); hull: the carved hull
// in place of the hair; views: the sheet, ours, ours over the sheet; close: the views larger; turn: the head turned 70°
// and nodded 40°, the idle and the walk, crossings counted; wire: the topology; sil: the silhouette; exploded: the pieces
// pulled apart; game: the full bodies at the game's zooms 5 and 10; shawl: the braid over the outfit's shawl.
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';

const DIR = new URL('.', import.meta.url).pathname;
export const REF = join(DIR, 'ref/hair-side-braid.png'), REF_SIZE = [1536, 1024], MASK = join(DIR, 'hairs/braid-mask.png');
const PIV = [0, 1, 0.1];
export const LABELS = [['front', 'Front (0°)'], ['q3', 'Three-quarter (45°)'], ['profile', 'Profile (90°)'], ['r3', 'Rear three-quarter (135°)'], ['back', 'Back (180°)']];
export const camOf = (c, k = 1, dy = 0) => ({ yaw: -c.yaw, pitch: -c.pitch, s: c.s * k, c: [PIV[0], PIV[1] + dy / c.s, PIV[2]] });
const cams = () => JSON.parse(readFileSync(join(DIR, 'hairs/braid-cams.json'), 'utf8'));
const TEAL = [0.2, 0.95, 0.85];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowbraid')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', ''), C = cams();
  const cw = 260, ch = 400, gap = 8, x0 = 10;

  if (only.includes('cams')) {
    // her head and neck (no hair) under each camera: row 1 the sheet; row 2 her body over the sheet, half see-through;
    // row 3 the sheet's silhouettes (white the hair, grey the skin) with her head and neck over them in teal
    const rig = buildRig('female'), bare = { shave: [] };
    const cells = [], imgs = [], y1 = 34, y2 = y1 + ch + 22, y3 = y2 + ch + 22;
    LABELS.forEach(([v, label], i) => {
      const c = C[v], x = x0 + i * (cw + gap), crop = [c.cx - cw / 2, 205 - ch / 2, cw, ch], dy = (c.cy - 205);
      imgs.push({ src: REF, size: REF_SIZE, crop, box: [x, y1, cw, ch] });
      imgs.push({ src: REF, size: REF_SIZE, crop, box: [x, y2, cw, ch] });
      imgs.push({ src: MASK, size: [1536, 410], crop, box: [x, y3, cw, ch] });
      const body = bodyMesh(rig, bare, rig.B.verts, SHEET_HAIR, { parts: ['head', 'neck', 'torso'] });
      cells.push({ meshes: [{ ...body, alpha: 0.55 }], cam: camOf(c, 1, dy), box: [x, y2, cw, ch], see: true, label });
      cells.push({ meshes: [{ ...body, col: body.col.map(() => TEAL), flat: true, alpha: 0.5 }], cam: camOf(c, 1, dy), box: [x, y3, cw, ch], see: true, label: `yaw ${c.yaw}°, pitch ${c.pitch}°, ${c.s} px/unit` });
    });
    await shoot(x0 * 2 + 5 * cw + 4 * gap, y3 + ch + 10, cells, join(out, `braid-cams${tag}.png`), {
      imgs, texts: [{ css: 'left:12px;top:6px', html: 'Side braid sheet: the cameras registered to her head and neck (row 2 her body over the sheet; row 3 over the sheet\'s hair, white, and skin, grey)' }] });
  }
  await closeBrowser();
}
