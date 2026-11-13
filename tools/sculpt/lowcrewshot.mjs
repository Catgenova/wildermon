// The crew cut's review sheets (tools/sculpt/lowcrew.mjs on the low-poly bodies), drawn by tools/sculpt/lowhairshot.mjs
// shoot, the bodies' own flat shading and the hair in its three tones and valleys as the game draws them.
//
//   node tools/sculpt/lowcrewshot.mjs --out <dir> [--tag -x] [--only views,wire,sheet]
// views: per body the head front, three-quarter, side, back and rear three-quarter (crew-views-<who>.png); wire: the
// topology (crew-wire.png); sheet: both bodies, four views, two hair colours (crew-sheet.png).
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { crewOf } from './lowcrew.mjs';

const WHO = { male: 'Type 1 (man)', female: 'Type 2 (woman)' };
const FAIR = [0.72, 0.55, 0.3];
const VIEWS = [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [-135, 'Rear three-quarter'], [180, 'Back']];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowcrew')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views,wire,sheet').split(','), tag = opt('tag', '');
  const RIGS = { male: buildRig('male'), female: buildRig('female') };
  const HAIRS = Object.fromEntries(Object.entries(RIGS).map(([w, r]) => [w, crewOf(r)]));
  const head = (rig, hair, col, edges = false) => [
    { ...bodyMesh(rig, hair, rig.B.verts, col, { parts: ['head', 'neck', 'torso'] }), ...(edges ? { edges: true, edgec: [0.95, 0.85, 0.78] } : {}) },
    { ...hairMesh(rig, hair, hair.verts, col), ...(edges ? { edges: true, edgec: [1, 0.93, 0.85] } : {}) },
  ];
  const cw = 340, ch = 400, gap = 8;
  if (only.includes('views')) for (const w of ['male', 'female']) {
    const rig = RIGS[w], hair = HAIRS[w];
    const cells = VIEWS.map(([yaw, label], i) => ({ meshes: head(rig, hair, SHEET_HAIR), cam: { yaw, pitch: 0, s: 175, c: [0, 1.15, hair.centre[2]] }, box: [10 + i * (cw + gap), 34, cw, ch], label }));
    cells.push(...VIEWS.map(([yaw, label], i) => ({ meshes: head(rig, hair, SHEET_HAIR), cam: { yaw, pitch: -28, s: 175, c: [0, 1.25, hair.centre[2]] }, box: [10 + i * (cw + gap), 34 + ch + gap, cw, ch], label: `${label}, from above` })));
    await shoot(10 + 5 * (cw + gap), 34 + 2 * (ch + gap), cells, join(out, `crew-views-${w}${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Crew cut, ${WHO[w]}: ${hair.polys.length} polygons, ${hair.tris.length} triangles` }] });
  }
  if (only.includes('wire')) {
    const cells = [];
    ['male', 'female'].forEach((w, r) => VIEWS.slice(0, 4).forEach(([yaw, label], i) => cells.push({ meshes: head(RIGS[w], HAIRS[w], SHEET_HAIR, true), cam: { yaw, pitch: 10, s: 175, c: [0, 1.2, HAIRS[w].centre[2]] }, box: [10 + i * (cw + gap), 34 + r * (ch + gap), cw, ch], label: `${WHO[w]} ${label}` })));
    await shoot(10 + 4 * (cw + gap), 34 + 2 * (ch + gap), cells, join(out, `crew-wire${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Crew cut topology: one closed shell per body' }] });
  }
  if (only.includes('sheet')) {
    const cells = [];
    let r = 0;
    for (const col of [SHEET_HAIR, FAIR]) for (const w of ['male', 'female']) {
      VIEWS.filter(([y]) => y !== -135).forEach(([yaw, label], i) => cells.push({ meshes: head(RIGS[w], HAIRS[w], col), cam: { yaw, pitch: 6, s: 150, c: [0, 1.1, HAIRS[w].centre[2]] }, box: [10 + i * (300 + gap), 34 + r * (340 + gap), 300, 340], label: `${WHO[w]} ${label}` }));
      r++;
    }
    await shoot(10 + 4 * (300 + gap), 34 + r * (340 + gap), cells, join(out, `crew-sheet${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Crew cut: both bodies, four views, two hair colours' }] });
  }
  await closeBrowser();
}
