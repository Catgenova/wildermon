// The leather chest as built (garments/leatherchest.mjs) against the approved trace, per view: the body and the armour
// in the view's review pose and body map (lowleatherchestview.mjs reviewVerts), rasterised with depth (what the sheet
// would show of each piece), each pixel the group of the piece in front; written per view as a label buffer for
// tools/sculpt/lowlchestfit.py to measure against the trace.
//
//   node tools/sculpt/lowlchestfit.mjs <out dir> [--who male] [--design '<json over the design>']
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { buildLeatherChest, leatherChestWeights, designOf } from './garments/leatherchest.mjs';
import { VIEWS, loadCams, reviewVerts, proj, DIR } from './lowleatherchestview.mjs';
const args = process.argv.slice(2), dir = args[0], opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
mkdirSync(dir, { recursive: true });
export const GROUPS = ['body', 'core', 'band1', 'band2', 'emblem', 'lacing', 'collar', 'belt', 'skirt.f', 'skirt.f2', 'skirt.b', 'skirtU.l', 'skirtU.r', 'skirtL.l', 'skirtL.r', 'back', 'back.panel', 'side.l', 'side.r', 'strap.l', 'strap.r', 'cap.l', 'cap.r', 'lame1.l', 'lame1.r', 'lame2.l', 'lame2.r', 'sleeve.l', 'sleeve.r', 'bracer.l', 'bracer.r', 'rune.l', 'rune.r', 'band.l', 'band.r', 'undershirt'];
/** A built polygon's group: its piece and tag. */
export function groupOf(p) {
  const s = (p.piece ?? '').match(/\.(l|r)$/)?.[1];
  const t = p.tag;
  if (t === 'chest') return 'core';
  if (t === 'band 1') return 'band1';
  if (t === 'band 2') return 'band2';
  if (t === 'emblem') return 'emblem';
  if (t === 'lacing') return 'lacing';
  if (t === 'back panel') return 'back.panel';
  if (t === 'pauldron' || t === 'zigzag') return `cap.${s}`;
  if (t === 'pauldron lame 1') return `lame1.${s}`;
  if (t === 'pauldron lame 2') return `lame2.${s}`;
  if (t === 'rune band') return `rune.${s}`;
  return p.piece;
}
const who = opt('who', 'male'), rig = buildRig(who), C = loadCams()[who];
const D = designOf(who); if (opt('design', null)) { const over = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? over(a[k], v) : v; return a; }; over(D, JSON.parse(opt('design'))); }
const G = buildLeatherChest(rig, D); G.vw = leatherChestWeights(rig, G);
const gidx = G.polys.map((p) => GROUPS.indexOf(groupOf(p)) + 1 || 0), hidden = new Set(G.hides);
const K = 4, out = {};
for (const view of VIEWS) {
  const T = JSON.parse(readFileSync(join(DIR, `leather/mesh/${who}-${view}.json`), 'utf8')), [x0, y0, x1, y1] = T.box, W = (x1 - x0) * K, H = (y1 - y0) * K;
  const { PB, PG } = reviewVerts(rig, G, C, view), QB = PB.map((p) => proj(p, C, view)), QG = PG.map((p) => proj(p, C, view));
  const zb = new Float32Array(W * H).fill(-1e9), lab = new Uint8Array(W * H);
  const tri = (a, b, c, l, bias = 0) => {
    const p = [a, b, c].map((q) => [(q[0] - x0) * K, (q[1] - y0) * K, q[2] + bias]);
    const xa = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), xb = Math.min(W - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const ya = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), yb = Math.min(H - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    const d = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]); if (Math.abs(d) < 1e-9) return;
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const l0 = ((p[1][1] - p[2][1]) * (x - p[2][0]) + (p[2][0] - p[1][0]) * (y - p[2][1])) / d, l1 = ((p[2][1] - p[0][1]) * (x - p[2][0]) + (p[0][0] - p[2][0]) * (y - p[2][1])) / d, l2 = 1 - l0 - l1;
      if (l0 < -1e-4 || l1 < -1e-4 || l2 < -1e-4) continue;
      const z = l0 * p[0][2] + l1 * p[1][2] + l2 * p[2][2], k = y * W + x; if (z > zb[k]) { zb[k] = z; lab[k] = l; }
    }
  };
  for (const t of rig.B.tris) if (!hidden.has(t.poly)) tri(QB[t.v[0]], QB[t.v[1]], QB[t.v[2]], 1);
  G.tris.forEach((t) => tri(QG[t.v[0]], QG[t.v[1]], QG[t.v[2]], gidx[t.poly], 0.002));
  out[view] = { box: T.box, K, W, H, lab: Buffer.from(lab).toString('base64') };
}
writeFileSync(join(dir, `fit-${who}.json`), JSON.stringify({ who, groups: GROUPS, views: out }));
console.log('wrote', join(dir, `fit-${who}.json`));
