// The twin braids' review sheets (tools/sculpt/lowtwinbraids.mjs on the low-poly bodies), drawn by
// tools/sculpt/lowhairshot.mjs shoot.
//
//   node tools/sculpt/lowtwinbraidsshot.mjs --out <dir> [--tag -x] [--who female,male] [--only views,wire,close,hat,sheet] [--raw]
// views: per body front, three-quarter, side, rear three-quarter and back; wire: the same with every polygon's outline;
// close: the head larger from the front, the front three-quarter, the side, the back and above; hat: pressed under the
// leather hat (tools/sculpt/garments/hat.mjs hatHair, read from src/sculpt/assets/lowhair.json: put the style there
// first); sheet: both bodies, the four views, in two hair colours. --raw: as built, not cleared off the body in the poses.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { buildTwinBraids, twinBraidsOf } from './lowtwinbraids.mjs';
import TWIN from './hairs/twinbraids.mjs';

const WHO = { female: 'Type 2 (woman)', male: 'Type 1 (man)' };
const VIEWS = [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [-135, 'Rear three-quarter'], [180, 'Back']];
const FAIR = [0.78, 0.6, 0.36];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowtwinbraids')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', ''), who = opt('who', 'female,male').split(',');
  const RIGS = Object.fromEntries(who.map((w) => [w, buildRig(w)]));
  const HAIRS = Object.fromEntries(who.map((w) => [w, args.includes('--raw') ? buildTwinBraids(RIGS[w], TWIN, { clear: false }) : twinBraidsOf(RIGS[w])]));
  const parts = ['head', 'neck', 'torso', 'joint', 'arm'];
  const name = TWIN.name;

  for (const mode of ['views', 'wire']) if (only.includes(mode)) {
    const cw = 300, ch = 400, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], hair = HAIRS[w], edges = mode === 'wire';
      VIEWS.forEach(([yaw, label], i) => cells.push({
        meshes: [{ ...bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts }), ...(edges ? { edges: true, edgec: [0.95, 0.85, 0.78] } : {}) }, { ...hairMesh(rig, hair), ...(edges ? { edges: true, edgec: [1, 0.93, 0.85] } : {}) }],
        cam: { yaw, pitch: 0, s: 105, c: [0, 0.4, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}`,
      }));
    });
    const said = who.map((w) => `${WHO[w]} ${HAIRS[w].tris.length} triangles`).join(', ');
    await shoot(10 + VIEWS.length * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `twinbraids-${mode}${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `${name}${mode === 'wire' ? ' topology' : ''}: ${said}` }] });
  }

  if (only.includes('close')) {
    const cw = 360, ch = 420, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], hair = HAIRS[w];
      [[0, 0, 'Front'], [-30, 0, 'Front three-quarter'], [-90, 0, 'Side'], [180, 0, 'Back'], [0, -40, 'From above']].forEach(([yaw, pitch, label], i) => cells.push({
        meshes: [bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts }), hairMesh(rig, hair)],
        cam: { yaw, pitch, s: 150, c: [0, 0.75, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}`,
      }));
    });
    await shoot(10 + 5 * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `twinbraids-close${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `${name}, close` }] });
  }

  if (only.includes('sheet')) {
    const cw = 260, ch = 360, cells = [];
    let r = 0;
    for (const [col, cname] of [[SHEET_HAIR, 'brown'], [FAIR, 'fair']]) for (const w of who) {
      const rig = RIGS[w], hair = HAIRS[w];
      [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [180, 'Back']].forEach(([yaw, label], i) => cells.push({
        meshes: [bodyMesh(rig, hair, rig.B.verts, col, { parts }), hairMesh(rig, hair, hair.verts, col)],
        cam: { yaw, pitch: 0, s: 95, c: [0, 0.5, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}, ${cname}`,
      }));
      r++;
    }
    await shoot(10 + 4 * (cw + 8), 34 + r * (ch + 30), cells, join(out, `twinbraids-sheet${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `${name}: ${who.map((w) => `${WHO[w]} ${HAIRS[w].tris.length} triangles`).join(', ')}` }] });
  }

  if (only.includes('hat')) {
    const { buildHat, hatHair } = await import('./garments/hat.mjs');
    const cw = 380, ch = 440, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], G = buildHat(rig), H = hatHair(rig, G, { style: 'twinbraids' });
      const hat = { who: w, P: G.verts, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => (p.piece === 'feather' ? [0.85, 0.8, 0.7] : p.mat === 'trim' ? [0.55, 0.42, 0.25] : [0.45, 0.3, 0.2])) };
      const hair = { ...H, polys: H.polys.map((v, i) => ({ v, valley: H.mat[i] > 4 ? H.mat[i] - 4 : 0 })), tris: H.tris.map((t) => [...t.v, t.poly]) };
      [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [180, 'Back']].forEach(([yaw, label], i) => cells.push({
        meshes: [bodyMesh(rig, { shave: H.shave }, rig.B.verts, SHEET_HAIR, { parts }), hairMesh(rig, hair), hat],
        cam: { yaw, pitch: 0, s: 105, c: [0, 0.75, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}: ${H.pressed.length} pressed, ${H.hatCross} through`,
      }));
    });
    await shoot(10 + 4 * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `twinbraids-hat${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `${name} under the leather hat (hatHair)` }] });
  }
  await closeBrowser();
}
