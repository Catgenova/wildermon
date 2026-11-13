// The pixie cut's review sheets (tools/sculpt/lowpixie.mjs on the low-poly bodies), drawn by tools/sculpt/lowhairshot.mjs
// shoot, the bodies' own flat shading and the hair in its three tones and valleys as the game draws them.
//
//   node tools/sculpt/lowpixieshot.mjs --out <dir> [--tag -x] [--only views,wire,sheet,hat]
// views: per body the head front, both three-quarters, both sides and the back, level and from above
// (pixie-views-<who>.png); wire: the topology (pixie-wire.png); sheet: both bodies, four views, two hair colours
// (pixie-sheet.png); hat: pressed under the leather hat (tools/sculpt/garments/hat.mjs hatHair, read from
// src/sculpt/assets/lowhair.json: the asset written first) (pixie-hat.png).
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { pixieOf } from './lowpixie.mjs';

const WHO = { male: 'Type 1 (man)', female: 'Type 2 (woman)' };
const FAIR = [0.72, 0.55, 0.3];
const VIEWS = [[0, 'Front'], [-45, 'Three-quarter, her right'], [45, 'Three-quarter, her left'], [-90, 'Side, her right'], [90, 'Side, her left'], [180, 'Back']];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowpixie')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views,wire,sheet').split(','), tag = opt('tag', '');
  const RIGS = { male: buildRig('male'), female: buildRig('female') };
  const HAIRS = Object.fromEntries(Object.entries(RIGS).map(([w, r]) => [w, pixieOf(r)]));
  const head = (rig, hair, col, edges = false) => [
    { ...bodyMesh(rig, hair, rig.B.verts, col, { parts: ['head', 'neck', 'torso'] }), ...(edges ? { edges: true, edgec: [0.95, 0.85, 0.78] } : {}) },
    { ...hairMesh(rig, hair, hair.verts, col), ...(edges ? { edges: true, edgec: [1, 0.93, 0.85] } : {}) },
  ];
  const cw = 320, ch = 380, gap = 8, NV = VIEWS.length;
  if (only.includes('views')) for (const w of ['male', 'female']) {
    const rig = RIGS[w], hair = HAIRS[w];
    const cells = VIEWS.map(([yaw, label], i) => ({ meshes: head(rig, hair, SHEET_HAIR), cam: { yaw, pitch: 0, s: 140, c: [0, 1.15, hair.centre[2]] }, box: [10 + i * (cw + gap), 34, cw, ch], label }));
    cells.push(...VIEWS.map(([yaw, label], i) => ({ meshes: head(rig, hair, SHEET_HAIR), cam: { yaw, pitch: -28, s: 140, c: [0, 1.25, hair.centre[2]] }, box: [10 + i * (cw + gap), 34 + ch + gap, cw, ch], label: `${label}, from above` })));
    await shoot(10 + NV * (cw + gap), 34 + 2 * (ch + gap), cells, join(out, `pixie-views-${w}${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Pixie cut, ${WHO[w]}: ${hair.polys.length} polygons, ${hair.tris.length} triangles` }] });
  }
  if (only.includes('wire')) {
    const cells = [];
    ['male', 'female'].forEach((w, r) => [VIEWS[0], VIEWS[1], VIEWS[4], VIEWS[5]].forEach(([yaw, label], i) => cells.push({ meshes: head(RIGS[w], HAIRS[w], SHEET_HAIR, true), cam: { yaw, pitch: 10, s: 170, c: [0, 1.2, HAIRS[w].centre[2]] }, box: [10 + i * (340 + gap), 34 + r * (400 + gap), 340, 400], label: `${WHO[w]} ${label}` })));
    await shoot(10 + 4 * (340 + gap), 34 + 2 * (400 + gap), cells, join(out, `pixie-wire${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Pixie cut topology: one closed shell per body' }] });
  }
  if (only.includes('sheet')) {
    const cells = [];
    let r = 0;
    for (const col of [SHEET_HAIR, FAIR]) for (const w of ['male', 'female']) {
      [VIEWS[0], VIEWS[1], VIEWS[4], VIEWS[5]].forEach(([yaw, label], i) => cells.push({ meshes: head(RIGS[w], HAIRS[w], col), cam: { yaw, pitch: 6, s: 150, c: [0, 1.1, HAIRS[w].centre[2]] }, box: [10 + i * (300 + gap), 34 + r * (340 + gap), 300, 340], label: `${WHO[w]} ${label}` }));
      r++;
    }
    await shoot(10 + 4 * (300 + gap), 34 + r * (340 + gap), cells, join(out, `pixie-sheet${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Pixie cut: both bodies, four views, two hair colours' }] });
  }
  if (only.includes('hat')) {
    const { buildHat, hatHair } = await import('./garments/hat.mjs');
    const cells = [], said = [];
    ['male', 'female'].forEach((w, r) => {
      const rig = RIGS[w], G = buildHat(rig), H = hatHair(rig, G, { style: 'pixie' });
      said.push(`${WHO[w]} ${H.pressed.length} vertices pressed, ${H.hatCross} through the hat`);
      const hat = { who: w, P: G.verts, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => (p.piece === 'feather' ? [0.85, 0.8, 0.7] : p.mat === 'trim' ? [0.55, 0.42, 0.25] : [0.45, 0.3, 0.2])) };
      const hair = { ...H, polys: H.polys.map((v, i) => ({ v, valley: H.mat[i] > 4 ? H.mat[i] - 4 : 0, buzz: H.mat[i] === 3 })), tris: H.tris.map((t) => [...t.v, t.poly]) };
      [VIEWS[0], VIEWS[1], VIEWS[4], VIEWS[5]].forEach(([yaw, label], i) => cells.push({
        meshes: [bodyMesh(rig, { shave: H.shave }, rig.B.verts, SHEET_HAIR, { parts: ['head', 'neck', 'torso'] }), hairMesh(rig, hair), hat],
        cam: { yaw, pitch: 14, s: 95, c: [0, 1.2, HAIRS[w].centre[2]] }, box: [10 + i * (340 + gap), 34 + r * (400 + gap), 340, 400], label: `${w === 'male' ? 'Man' : 'Woman'}, ${label.toLowerCase()}, from below`,
      }));
    });
    await shoot(10 + 4 * (340 + gap), 34 + 2 * (400 + gap), cells, join(out, `pixie-hat${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Pixie cut under the leather hat (hatHair): ${said.join('; ')}` }] });
  }
  await closeBrowser();
}
