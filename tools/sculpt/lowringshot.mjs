// The ring styles' review sheets (tools/sculpt/lowring.mjs: balding, the monk cut, on the low-poly bodies), drawn by
// tools/sculpt/lowhairshot.mjs shoot: the hair in the game's three tones of a hair colour (its valleys darker), the
// thinning and the trim in the shaved scalp's tone.
//
//   node tools/sculpt/lowringshot.mjs --out <dir> [--style balding] [--tag -x] [--only views,wire,colours] [--raw]
//   [--col r,g,b] [--scale 1]
// views: both bodies, front, three-quarter, side, back and from above (<style>-views<tag>.png); wire: the topology
// (<style>-wire<tag>.png); colours: both bodies, five views, in brown and blond (<style>-colours<tag>.png).
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, SHEET_HAIR, SKIN, SHAVE } from './lowhairshot.mjs';
import { buildRing, RING_STYLES } from './lowring.mjs';

const VALLEY_MARK = 10;
const mix = (a, b, t) => a.map((x, k) => x + (b[k] - x) * t);
/** The hair's mesh for shoot(): a hair polygon's colour negative (lit in the hair's three tones), a valley's marked by
 * its step, a shaved band's the shaved scalp's tone. */
export function ringMesh(rig, hair, H = hair.verts, hairCol = SHEET_HAIR) {
  return { who: rig.who, P: H, polys: hair.polys.map((p) => p.v), tris: hair.tris, col: hair.polys.map((p) => (p.shaved ? mix(SKIN, hairCol, SHAVE) : hairCol.map((x, c) => -x - (p.valley && !c ? VALLEY_MARK * p.valley : 0)))) };
}
const VIEWS = [[0, 'Front', -8], [-45, 'Three-quarter', -8], [-90, 'Side', -8], [-150, 'Back three-quarter', -8], [180, 'Back', -8], [-30, 'Above', -50]];
const BLOND = [0.78, 0.62, 0.36];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowring')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', ''), id = opt('style', 'balding');
  const RIGS = { male: buildRig('male'), female: buildRig('female') };
  const HAIRS = Object.fromEntries(Object.entries(RIGS).map(([w, r]) => [w, buildRing(r, RING_STYLES[id], { clear: !args.includes('--raw') })]));
  const cw = 260, ch = 290, gap = 6;
  const cam = (yaw, pitch, w) => ({ yaw, pitch, s: 140, c: [0, w === 'female' ? 1.2 : 1.17, 0] });
  const cellsFor = (cols, y0, edges = false) => {
    const cells = [];
    ['male', 'female'].forEach((w, r) => cols.forEach(([hairCol], ci) => VIEWS.forEach(([yaw, , pitch], i) => {
      const rig = RIGS[w], hair = HAIRS[w], x = 6 + (ci * VIEWS.length + i) * (cw + gap), y = y0 + r * (ch + gap);
      const body = bodyMesh(rig, hair, rig.B.verts, hairCol, { parts: ['head', 'neck', 'torso'] }), hm = ringMesh(rig, hair, hair.verts, hairCol);
      cells.push({ meshes: edges ? [{ ...body, edges: true, edgec: [0.95, 0.85, 0.78] }, { ...hm, edges: true, edgec: [1, 0.93, 0.85] }] : [body, hm], cam: cam(yaw, pitch, w), box: [x, y, cw, ch], label: '' });
    })));
    return cells;
  };
  const COL = opt('col', '') ? opt('col', '').split(',').map(Number) : SHEET_HAIR;
  const W = (k) => 12 + k * VIEWS.length * (cw + gap), H = 12 + 2 * (ch + gap);
  if (only.includes('views')) await shoot(W(1), H, cellsFor([[COL]], 6), join(out, `${id}-views${tag}.png`));
  if (only.includes('wire')) await shoot(W(1), H, cellsFor([[SHEET_HAIR]], 6, true), join(out, `${id}-wire${tag}.png`));
  if (only.includes('colours')) await shoot(W(2), H, cellsFor([[SHEET_HAIR], [BLOND]], 6), join(out, `${id}-colours${tag}.png`));
  await closeBrowser();
}
