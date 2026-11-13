// The side shave's review sheets (tools/sculpt/lowsideshave.mjs on the low-poly bodies), drawn by
// tools/sculpt/lowhairshot.mjs shoot.
//
//   node tools/sculpt/lowsideshaveshot.mjs --out <dir> [--tag -x] [--who female,male] [--only views,wire,close,hat,sheet] [--raw]
// views: per body front, the shaved side's three-quarter and side, the long side's side and three-quarter, the back;
// wire: the same with every polygon's outline; close: the head larger; hat: pressed under the leather hat
// (tools/sculpt/garments/hat.mjs hatHair, read from src/sculpt/assets/lowhair.json: swap the style's entries in first);
// sheet: both bodies, four views, in two hair colours. --raw: as built, before clearBody.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { buildSideshave } from './lowsideshave.mjs';

const WHO = { female: 'Type 2 (woman)', male: 'Type 1 (man)' };
// (yaw 90 looks at the body's left, the shaved side; -90 at its right)
const VIEWS = [[0, 'Front'], [45, 'Shaved three-quarter'], [90, 'Shaved side'], [-90, 'Long side'], [-45, 'Long three-quarter'], [180, 'Back']];
const FAIR = [0.78, 0.6, 0.36];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowsideshave')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', ''), who = opt('who', 'female,male').split(',');
  const RIGS = Object.fromEntries(who.map((w) => [w, buildRig(w)]));
  const HAIRS = Object.fromEntries(who.map((w) => [w, buildSideshave(RIGS[w], undefined, { clear: !args.includes('--raw') })]));
  const parts = ['head', 'neck', 'torso', 'joint', 'arm'];

  for (const mode of ['views', 'wire']) if (only.includes(mode)) {
    const cw = 280, ch = 420, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], hair = HAIRS[w], edges = mode === 'wire';
      VIEWS.forEach(([yaw, label], i) => cells.push({
        meshes: [{ ...bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts }), ...(edges ? { edges: true, edgec: [0.95, 0.85, 0.78] } : {}) }, { ...hairMesh(rig, hair), ...(edges ? { edges: true, edgec: [1, 0.93, 0.85] } : {}) }],
        cam: { yaw, pitch: 0, s: 80, c: [0, 0.2, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}`,
      }));
    });
    const said = who.map((w) => `${WHO[w]} ${HAIRS[w].tris.length} triangles`).join(', ');
    await shoot(10 + VIEWS.length * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `sideshave-${mode}${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Side shave ${mode === 'wire' ? 'topology' : ''}: ${said}` }] });
  }

  if (only.includes('close')) {
    const cw = 330, ch = 400, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], hair = HAIRS[w];
      [[0, 0, 'Front'], [60, 0, 'Shaved side'], [-60, 0, 'Long side'], [180, 0, 'Back'], [30, -45, 'From above']].forEach(([yaw, pitch, label], i) => cells.push({
        meshes: [bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts }), hairMesh(rig, hair)],
        cam: { yaw, pitch, s: 140, c: [0, 0.95, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}`,
      }));
    });
    await shoot(10 + 5 * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `sideshave-close${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Side shave, close' }] });
  }

  if (only.includes('sheet')) {
    const cw = 260, ch = 400, cells = [];
    let r = 0;
    for (const [col, name] of [[SHEET_HAIR, 'brown'], [FAIR, 'fair']]) for (const w of who) {
      const rig = RIGS[w], hair = HAIRS[w];
      [[0, 'Front'], [45, 'Shaved 3/4'], [-90, 'Long side'], [180, 'Back']].forEach(([yaw, label], i) => cells.push({
        meshes: [bodyMesh(rig, hair, rig.B.verts, col, { parts }), hairMesh(rig, hair, hair.verts, col)],
        cam: { yaw, pitch: 0, s: 88, c: [0, 0.35, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}, ${name}`,
      }));
      r++;
    }
    await shoot(10 + 4 * (cw + 8), 34 + r * (ch + 30), cells, join(out, `sideshave-sheet${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Side shave: ${who.map((w) => `${WHO[w]} ${HAIRS[w].tris.length} triangles`).join(', ')}` }] });
  }

  if (only.includes('hat')) {
    const { buildHat, hatHair } = await import('./garments/hat.mjs');
    const cw = 330, ch = 420, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], G = buildHat(rig), H = hatHair(rig, G, { style: 'sideshave' });
      const hat = { who: w, P: G.verts, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => (p.piece === 'feather' ? [0.85, 0.8, 0.7] : p.mat === 'trim' ? [0.55, 0.42, 0.25] : [0.45, 0.3, 0.2])) };
      const hair = { ...H, polys: H.polys.map((v, i) => ({ v, valley: H.mat[i] > 4 ? H.mat[i] - 4 : 0 })), tris: H.tris.map((t) => [...t.v, t.poly]) };
      [[0, 'Front'], [60, 'Shaved side'], [-60, 'Long side'], [180, 'Back']].forEach(([yaw, label], i) => cells.push({
        meshes: [bodyMesh(rig, { shave: H.shave }, rig.B.verts, SHEET_HAIR, { parts }), hairMesh(rig, hair), hat],
        cam: { yaw, pitch: 0, s: 110, c: [0, 0.6, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}: ${H.pressed.length} pressed, ${H.hatCross} through the hat`,
      }));
    });
    await shoot(10 + 4 * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `sideshave-hat${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Side shave under the leather hat (hatHair)' }] });
  }
  await closeBrowser();
}
