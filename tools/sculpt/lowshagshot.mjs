// The shag's review sheets (tools/sculpt/lowshag.mjs on the low-poly bodies), drawn by
// tools/sculpt/lowhairshot.mjs shoot.
//
//   node tools/sculpt/lowshagshot.mjs --out <dir> [--tag -x] [--who female,male] [--only views,wire,close,hat,sheet] [--raw | --asset | --load <dir>]
// views: per body front, three-quarter, side, back and the rear three-quarter; wire: the same with every polygon's
// outline; close: the head larger from the front, the side and the back; hat: pressed under the leather hat
// (tools/sculpt/garments/hat.mjs hatHair, read from src/sculpt/assets/lowhair.json: run the asset first); sheet: both
// bodies, the four views, in two hair colours. --raw: the hair as built, not yet kept off the body in the clips' poses; --asset: the game's copy
// (src/sculpt/assets/lowhair.json 'shag', written by tools/sculpt/lowshag.mjs --asset) instead of building it;
// --load: the shag kept by tools/sculpt/lowshag.mjs --save <dir>.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { shagOf } from './lowshag.mjs';

const WHO = { female: 'Type 2 (woman)', male: 'Type 1 (man)' };
const VIEWS = [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [-135, 'Rear three-quarter'], [180, 'Back']];
const FAIR = [0.78, 0.6, 0.36];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowshag')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', ''), who = opt('who', 'female,male').split(',');
  const RIGS = Object.fromEntries(who.map((w) => [w, buildRig(w)]));
  // (the game's copy: its polygons' valleys from their materials, 5 to 8 a valley's step)
  const fromAsset = async (w) => {
    const H = (await import('./garments/hat.mjs')).hairMesh(w, 'shag');
    return { ...H, polys: H.polys.map((v, i) => ({ v, ...(H.mat[i] > 4 ? { valley: H.mat[i] - 4 } : {}) })), tris: H.tris.map((t) => [...t.v, t.poly]) };
  };
  const HAIRS = {};
  for (const w of who) HAIRS[w] = args.includes('--asset') ? await fromAsset(w) : shagOf(RIGS[w], undefined, { clear: !args.includes('--raw'), load: opt('load') });
  const parts = ['head', 'neck', 'torso', 'joint', 'arm'];

  for (const mode of ['views', 'wire']) if (only.includes(mode)) {
    const cw = 300, ch = 400, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], hair = HAIRS[w], edges = mode === 'wire';
      VIEWS.forEach(([yaw, label], i) => cells.push({
        meshes: [{ ...bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts }), ...(edges ? { edges: true, edgec: [0.95, 0.85, 0.78] } : {}) }, { ...hairMesh(rig, hair), ...(edges ? { edges: true, edgec: [1, 0.93, 0.85] } : {}) }],
        cam: { yaw, pitch: 0, s: 105, c: [0, 0.75, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}`,
      }));
    });
    const said = who.map((w) => `${WHO[w]} ${HAIRS[w].tris.length} triangles`).join(', ');
    await shoot(10 + VIEWS.length * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `shag-${mode}${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Shag ${mode === 'wire' ? 'topology' : ''}: ${said}` }] });
  }

  if (only.includes('close')) {
    const cw = 360, ch = 420, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], hair = HAIRS[w];
      [[0, 0, 'Front'], [-30, 0, 'Front three-quarter'], [-90, 0, 'Side'], [180, 0, 'Back'], [0, -40, 'From above']].forEach(([yaw, pitch, label], i) => cells.push({
        meshes: [bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts }), hairMesh(rig, hair)],
        cam: { yaw, pitch, s: 150, c: [0, 1.0, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}`,
      }));
    });
    await shoot(10 + 5 * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `shag-close${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Shag, close' }] });
  }

  if (only.includes('sheet')) {
    const cw = 260, ch = 360, cells = [];
    let r = 0;
    for (const [col, name] of [[SHEET_HAIR, 'brown'], [FAIR, 'fair']]) for (const w of who) {
      const rig = RIGS[w], hair = HAIRS[w];
      [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [180, 'Back']].forEach(([yaw, label], i) => cells.push({
        meshes: [bodyMesh(rig, hair, rig.B.verts, col, { parts }), hairMesh(rig, hair, hair.verts, col)],
        cam: { yaw, pitch: 0, s: 95, c: [0, 0.7, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}, ${name}`,
      }));
      r++;
    }
    await shoot(10 + 4 * (cw + 8), 34 + r * (ch + 30), cells, join(out, `shag-sheet${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Shag: ${who.map((w) => `${WHO[w]} ${HAIRS[w].tris.length} triangles`).join(', ')}` }] });
  }

  if (only.includes('hat')) {
    const { buildHat, hatHair } = await import('./garments/hat.mjs');
    const cw = 330, ch = 400, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], G = buildHat(rig), H = hatHair(rig, G, { style: 'shag' });
      const hat = { who: w, P: G.verts, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => (p.piece === 'feather' ? [0.85, 0.8, 0.7] : p.mat === 'trim' ? [0.55, 0.42, 0.25] : [0.45, 0.3, 0.2])) };
      const hair = { ...H, polys: H.polys.map((v, i) => ({ v, valley: H.mat[i] > 4 ? H.mat[i] - 4 : 0 })), tris: H.tris.map((t) => [...t.v, t.poly]) };
      [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [180, 'Back']].forEach(([yaw, label], i) => cells.push({
        meshes: [bodyMesh(rig, { shave: H.shave }, rig.B.verts, SHEET_HAIR, { parts }), hairMesh(rig, hair), hat],
        cam: { yaw, pitch: 0, s: 150, c: [0, 0.9, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}: ${H.pressed.length} pressed, ${H.hatCross} through the hat`,
      }));
    });
    await shoot(10 + 4 * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `shag-hat${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Shag under the leather hat (hatHair)' }] });
  }
  await closeBrowser();
}

