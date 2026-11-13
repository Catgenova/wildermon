// The pompadour's review sheets (tools/sculpt/lowpomp.mjs on the low-poly bodies), drawn by tools/sculpt/lowhairshot.mjs
// shoot: no reference sheet, so each body's head in four views (front, three-quarter, side, back) and the wire.
//
//   node tools/sculpt/lowpompshot.mjs --out <dir> [--tag -x] [--who male,female] [--only views,wire,colours,hat]
// views: <dir>/pomp-views<tag>.png, both bodies (rows), four views (columns), the sheets' brown; wire: the topology;
// colours: the final sheet, both bodies, four views, in three hair colours; hat: the hair pressed under the leather hat
// (tools/sculpt/garments/hat.mjs hatHair, read from src/sculpt/assets/lowhat-<who>.json) and the hat over it.
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { pompOf } from './lowpomp.mjs';

const VIEWS = [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [180, 'Back']];
const WHO = { male: 'Type 1 (man)', female: 'Type 2 (woman)' };
/** A second hair colour for the final sheet: a dark ash blond. */
const BLOND = [0.62, 0.5, 0.32];
const BLACK = [0.16, 0.13, 0.13];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowpomp')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', ''), who = opt('who', 'male,female').split(',');
  const RIGS = Object.fromEntries(who.map((w) => [w, buildRig(w)]));
  const HAIRS = Object.fromEntries(who.map((w) => [w, pompOf(RIGS[w])]));
  const cw = 330, ch = 380, gap = 8;
  const head = (yaw, s = 125) => ({ yaw, pitch: 6, s, c: [0, 1.35, 0] });
  const sheet = async (file, title, rows) => {
    const cells = [];
    rows.forEach(([w, col, extra], r) => VIEWS.forEach(([yaw, label], i) => {
      const rig = RIGS[w], hair = HAIRS[w], x = 10 + i * (cw + gap), y = 34 + r * (ch + gap);
      cells.push({ meshes: [bodyMesh(rig, hair, rig.B.verts, col, { parts: ['head', 'neck', 'torso'] }), hairMesh(rig, hair, hair.verts, col), ...(extra ? extra(w) : [])], cam: head(yaw), box: [x, y, cw, ch], label: `${WHO[w]} ${label}` });
    }));
    await shoot(10 + 4 * (cw + gap), 34 + rows.length * (ch + gap), cells, file, { texts: [{ css: 'left:12px;top:6px', html: title }] });
  };
  const counts = who.map((w) => `${WHO[w]} ${HAIRS[w].tris.length} triangles`).join(', ');
  if (only.includes('views')) await sheet(join(out, `pomp-views${tag}.png`), `Pompadour: ${counts}`, who.map((w) => [w, SHEET_HAIR]));
  if (only.includes('colours')) await sheet(join(out, `pomp-colours${tag}.png`), `Pompadour, three hair colours: ${counts}`, [...who.map((w) => [w, SHEET_HAIR]), ...who.map((w) => [w, BLOND]), ...who.map((w) => [w, BLACK])]);
  if (only.includes('wire')) {
    const cells = [];
    who.forEach((w, r) => VIEWS.forEach(([yaw, label], i) => {
      const rig = RIGS[w], hair = HAIRS[w];
      cells.push({ meshes: [{ ...bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts: ['head', 'neck', 'torso'] }), edges: true, edgec: [0.95, 0.85, 0.78] }, { ...hairMesh(rig, hair), edges: true, edgec: [1, 0.93, 0.85] }], cam: head(yaw), box: [10 + i * (cw + gap), 34 + r * (ch + gap), cw, ch], label: `${WHO[w]} ${label}` });
    }));
    await shoot(10 + 4 * (cw + gap), 34 + who.length * (ch + gap), cells, join(out, `pomp-wire${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Pompadour topology: ${counts}` }] });
  }
  if (only.includes('hat')) {
    // the hat's own mesh and the pressed hair, from the game's copy (src/sculpt/assets/lowhat-<who>.json)
    const cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], A = JSON.parse(readFileSync(new URL(`../../src/sculpt/assets/lowhat-${w}.json`, import.meta.url), 'utf8')), H = A.hair?.pompadour;
      if (!H) { console.log(w, 'no pressed pompadour in lowhat'); return; }
      const hv = []; for (let i = 0; i < H.verts.length; i += 3) hv.push([H.verts[i], H.verts[i + 1], H.verts[i + 2]]);
      const ht = []; for (let i = 0; i < H.tris.length; i += 4) ht.push(H.tris.slice(i, i + 4));
      const pressed = { verts: hv, polys: H.polys.map((v, i) => ({ v, valley: H.mat[i] > 4 ? H.mat[i] - 4 : 0, buzz: H.mat[i] === 3 })), tris: ht, shave: H.shave };
      const gv = []; for (let i = 0; i < A.verts.length; i += 3) gv.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
      const gt = []; for (let i = 0; i < A.tris.length; i += 4) gt.push(A.tris.slice(i, i + 4));
      const hatPolys = A.polys.map(([v]) => v), hatCol = A.polys.map(([, m]) => A.colours[m] ?? [0.42, 0.22, 0.18]);
      VIEWS.forEach(([yaw, label], i) => {
        const x = 10 + i * (cw + gap), y = 34 + r * 2 * (ch + gap);
        cells.push({ meshes: [bodyMesh(rig, pressed, rig.B.verts, SHEET_HAIR, { parts: ['head', 'neck', 'torso'] }), hairMesh(rig, pressed, hv)], cam: head(yaw), box: [x, y, cw, ch], label: `${WHO[w]} ${label}: pressed, hat off` });
        cells.push({ meshes: [bodyMesh(rig, pressed, rig.B.verts, SHEET_HAIR, { parts: ['head', 'neck', 'torso'] }), hairMesh(rig, pressed, hv), { who: w, P: gv, polys: hatPolys, tris: gt, col: hatCol }], cam: head(yaw), box: [x, y + ch + gap, cw, ch], label: `${WHO[w]} ${label}: under the hat` });
      });
    });
    await shoot(10 + 4 * (cw + gap), 34 + who.length * 2 * (ch + gap), cells, join(out, `pomp-hat${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Pompadour under the leather hat (hatHair): pressed (hat hidden), and with the hat' }] });
  }
  await closeBrowser();
}
