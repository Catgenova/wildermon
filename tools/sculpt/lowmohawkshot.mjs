// The mohawk's review sheets (tools/sculpt/lowmohawk.mjs on the low-poly bodies), drawn by tools/sculpt/lowhairshot.mjs
// shoot: the hair as the game shades it (three tones by the light, the valleys darker, the shaved scalp in the shave's
// tone).
//
//   node tools/sculpt/lowmohawkshot.mjs --out <dir> [--tag -x] [--only views,wire,hat,sheet]
// views: <dir>/mohawk-views<tag>.png: each body front, three-quarter, side and back, the head close;
// wire: <dir>/mohawk-wire<tag>.png: the topology, each body;
// hat: <dir>/mohawk-hat<tag>.png: the hair pressed under the leather hat (src/sculpt/assets/lowhat-<who>.json), the hat
// drawn see-through over it, and the pressed hair alone;
// sheet: <dir>/mohawk-sheet<tag>.png: both bodies, the four views, in two hair colours.
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { mohawkOf } from './lowmohawk.mjs';

const WHO = { male: 'Type 1 (man)', female: 'Type 2 (woman)' };
const VIEWS = [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [180, 'Back']];
/** A light hair colour beside the review renders' brown (the facets' tones read differently on it). */
const BLOND = [0.82, 0.66, 0.38];
const HEAD = ['head', 'neck', 'torso'];
const cam = (yaw, s = 125, c = [0, 1.2, 0]) => ({ yaw, pitch: 0, s, c });
/** A game hair asset (src/sculpt/assets/lowhair.json's or lowhat-<who>.json's) as a mesh the shots take. */
const fromAsset = (h) => {
  const verts = []; for (let i = 0; i < h.verts.length; i += 3) verts.push([h.verts[i], h.verts[i + 1], h.verts[i + 2]]);
  const tris = []; for (let i = 0; i < h.tris.length; i += 4) tris.push([h.tris[i], h.tris[i + 1], h.tris[i + 2], h.tris[i + 3]]);
  return { verts, tris, polys: h.polys.map((v, j) => ({ v, buzz: h.mat[j] === 3, valley: h.mat[j] > 4 ? h.mat[j] - 4 : 0 })), shave: h.shave };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowmohawk')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', '');
  const RIGS = { male: buildRig('male'), female: buildRig('female') };
  const HAIRS = { male: mohawkOf(RIGS.male), female: mohawkOf(RIGS.female) };
  const cw = 300, ch = 380, gap = 8, top = 34;
  const row = (who, y, col = SHEET_HAIR, hair = HAIRS[who], extra = []) => VIEWS.map(([yaw, label], i) => ({
    meshes: [bodyMesh(RIGS[who], hair, RIGS[who].B.verts, col, { parts: HEAD }), hairMesh(RIGS[who], hair, hair.verts, col), ...extra],
    cam: cam(yaw), box: [10 + i * (cw + gap), y, cw, ch], label: `${WHO[who]} ${label}`,
  }));

  if (only.includes('views')) {
    const cells = [...row('male', top), ...row('female', top + ch + gap)];
    const say = ['male', 'female'].map((w) => `${WHO[w]} ${HAIRS[w].tris.length} triangles`).join(', ');
    await shoot(20 + 4 * cw + 3 * gap, top + 2 * ch + gap + 10, cells, join(out, `mohawk-views${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Mohawk: ${say}` }] });
  }

  if (only.includes('wire')) {
    const cells = ['male', 'female'].flatMap((w, r) => VIEWS.map(([yaw, label], i) => ({
      meshes: [{ ...bodyMesh(RIGS[w], HAIRS[w], RIGS[w].B.verts, SHEET_HAIR, { parts: HEAD }), edges: true, edgec: [0.95, 0.85, 0.78] }, { ...hairMesh(RIGS[w], HAIRS[w]), edges: true, edgec: [1, 0.93, 0.85] }],
      cam: cam(yaw), box: [10 + i * (cw + gap), top + r * (ch + gap), cw, ch], label: `${WHO[w]} ${label}`,
    })));
    await shoot(20 + 4 * cw + 3 * gap, top + 2 * ch + gap + 10, cells, join(out, `mohawk-wire${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Mohawk topology: one closed shell, the buzz patches' }] });
  }

  if (only.includes('hat')) {
    // the leather hat's game copy: its mesh and the mohawk pressed under it
    const cells = [];
    ['male', 'female'].forEach((w, r) => {
      const A = JSON.parse(readFileSync(new URL(`../../src/sculpt/assets/lowhat-${w}.json`, import.meta.url), 'utf8'));
      const pressed = fromAsset(A.hair.mohawk), hat = fromAsset({ verts: A.verts, tris: A.tris, polys: A.polys.map((p) => p[0] ?? p), mat: A.polys.map(() => 0), shave: [] });
      const hatMesh = { who: w, P: hat.verts, polys: hat.polys.map((p) => p.v), tris: hat.tris, col: hat.polys.map(() => [0.55, 0.36, 0.22]), alpha: 0.45 };
      [[0, 'Front'], [-90, 'Side'], [180, 'Back']].forEach(([yaw, label], i) => {
        cells.push({ meshes: [bodyMesh(RIGS[w], pressed, RIGS[w].B.verts, SHEET_HAIR, { parts: HEAD }), hairMesh(RIGS[w], pressed), hatMesh], cam: cam(yaw), box: [10 + i * (cw + gap), top + r * (ch + gap), cw, ch], label: `${WHO[w]} ${label}, the hat see-through` });
      });
      cells.push({ meshes: [bodyMesh(RIGS[w], pressed, RIGS[w].B.verts, SHEET_HAIR, { parts: HEAD }), hairMesh(RIGS[w], pressed)], cam: cam(-45), box: [10 + 3 * (cw + gap), top + r * (ch + gap), cw, ch], label: `${WHO[w]} pressed, the hat off` });
    });
    await shoot(20 + 4 * cw + 3 * gap, top + 2 * ch + gap + 10, cells, join(out, `mohawk-hat${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Mohawk pressed under the leather hat (src/sculpt/assets/lowhat-&lt;who&gt;.json)' }] });
  }

  if (only.includes('sheet')) {
    const cells = [], y = (r) => top + r * (ch + gap);
    cells.push(...row('male', y(0)), ...row('female', y(1)), ...row('male', y(2), BLOND), ...row('female', y(3), BLOND));
    const say = ['male', 'female'].map((w) => `${WHO[w]} ${HAIRS[w].tris.length} triangles`).join(', ');
    await shoot(20 + 4 * cw + 3 * gap, y(4) + 10, cells, join(out, `mohawk-sheet${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Mohawk: both bodies, front, three-quarter, side, back; brown (top), blond (bottom). ${say}` }] });
  }
  await closeBrowser();
}
