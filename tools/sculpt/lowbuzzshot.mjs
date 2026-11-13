// The buzz cut's review sheets (tools/sculpt/lowbuzz.mjs on the low-poly bodies), drawn by tools/sculpt/lowhairshot.mjs
// shoot: the hair in the game's three tones of a hair colour (its valleys darker), the taper in the shaved scalp's tone.
//
//   node tools/sculpt/lowbuzzshot.mjs --out <dir> [--tag -x] [--only views,wire,colours] [--raw] [--col r,g,b]
// views: both bodies, front, three-quarter, side, back, the head close (buzz-views<tag>.png); wire: the topology
// (buzz-wire<tag>.png); --raw: as laid, not cleared off the body; colours: both bodies, the four views, in two hair colours (buzz-colours<tag>.png).
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, SHEET_HAIR, SKIN, SHAVE } from './lowhairshot.mjs';
import { buildBuzz } from './lowbuzz.mjs';

const VALLEY_MARK = 10;
const mix = (a, b, t) => a.map((x, k) => x + (b[k] - x) * t);
/** The hair's mesh for shoot(): a hair polygon's colour negative (lit in the hair's three tones), a valley's marked by
 * its step, the taper's the shaved scalp's tone. */
export function buzzMesh(rig, hair, H = hair.verts, hairCol = SHEET_HAIR) {
  return { who: rig.who, P: H, polys: hair.polys.map((p) => p.v), tris: hair.tris, col: hair.polys.map((p) => (p.shaved ? mix(SKIN, hairCol, SHAVE) : hairCol.map((x, c) => -x - (p.valley && !c ? VALLEY_MARK * p.valley : 0)))) };
}
const WHO = { male: 'Type 1 (man)', female: 'Type 2 (woman)' };
const VIEWS = [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [180, 'Back']];
/** A light hair colour beside the review renders' brown. */
const BLOND = [0.78, 0.62, 0.36];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowbuzz')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', '');
  const RIGS = { male: buildRig('male'), female: buildRig('female') };
  const HAIRS = Object.fromEntries(Object.entries(RIGS).map(([w, r]) => [w, buildBuzz(r, undefined, { clear: !args.includes('--raw') })]));
  const cw = 300, ch = 330, gap = 8;
  const cam = (yaw, w) => ({ yaw, pitch: -8, s: 165, c: [0, w === 'female' ? 1.2 : 1.17, 0] });
  const cellsFor = (cols, y0, edges = false) => {
    const cells = [];
    ['male', 'female'].forEach((w, r) => cols.forEach(([hairCol, colName], ci) => VIEWS.forEach(([yaw, label], i) => {
      const rig = RIGS[w], hair = HAIRS[w], x = 10 + (ci * VIEWS.length + i) * (cw + gap), y = y0 + r * (ch + gap);
      const body = bodyMesh(rig, hair, rig.B.verts, hairCol, { parts: ['head', 'neck', 'torso'] }), hm = buzzMesh(rig, hair, hair.verts, hairCol);
      cells.push({ meshes: edges ? [{ ...body, edges: true, edgec: [0.95, 0.85, 0.78] }, { ...hm, edges: true, edgec: [1, 0.93, 0.85] }] : [body, hm], cam: cam(yaw, w), box: [x, y, cw, ch], label: `${WHO[w]} ${label}${colName ? ` (${colName})` : ''}` });
    })));
    return cells;
  };
  const tris = `${HAIRS.male.tris.length} / ${HAIRS.female.tris.length} triangles (Type 1 / Type 2)`;
  // (--col r,g,b: the views in that hair colour, 0..1)
  const COL = opt('col', '') ? opt('col', '').split(',').map(Number) : SHEET_HAIR;
  if (only.includes('views')) {
    await shoot(20 + 4 * (cw + gap), 44 + 2 * (ch + gap), cellsFor([[COL, '']], 40), join(out, `buzz-views${tag}.png`), { texts: [{ css: 'left:12px;top:8px', html: `Buzz cut: ${tris}` }] });
  }
  if (only.includes('wire')) {
    await shoot(20 + 4 * (cw + gap), 44 + 2 * (ch + gap), cellsFor([[SHEET_HAIR, '']], 40, true), join(out, `buzz-wire${tag}.png`), { texts: [{ css: 'left:12px;top:8px', html: `Buzz cut topology: ${tris}, one closed shell` }] });
  }
  if (only.includes('colours')) {
    await shoot(20 + 8 * (cw + gap), 44 + 2 * (ch + gap), cellsFor([[SHEET_HAIR, 'brown'], [BLOND, 'blond']], 40), join(out, `buzz-colours${tag}.png`), { texts: [{ css: 'left:12px;top:8px', html: `Buzz cut, both bodies, four views, two hair colours: ${tris}` }] });
  }
  await closeBrowser();
}
