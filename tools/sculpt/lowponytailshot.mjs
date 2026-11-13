// The high ponytail's review sheets (tools/sculpt/lowponytail.mjs on the low-poly bodies), drawn by
// tools/sculpt/lowhairshot.mjs shoot.
//
//   node tools/sculpt/lowponytailshot.mjs --out <dir> [--tag -x] [--who male,female] [--only views,wire,close,hat,sheet,poses]
// views: per body front, three-quarter, side, back and the rear three-quarter, head to the shoulder blades; wire: the
// same with every polygon's outline; close: the head larger (front, three-quarter, side, back, from above behind); hat:
// pressed under the leather hat (tools/sculpt/garments/hat.mjs hatHair, read from src/sculpt/assets/lowhair.json: swap the
// style in first); sheet: both bodies, the four views, in two hair colours; poses: the head turned and nodded, and the
// clips' poses given by --clips (the $clip names of tools/sculpt/hairs/ponytail-poses-<who>.json), from the side behind;
// --raw: the hair as built, not yet cleared of the body in the clips' poses.
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig, posed, skin } from './lowrig.mjs';
import { skinHair } from './lowhair.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { buildPonytail } from './lowponytail.mjs';
import { POSES } from './lowtopknot.mjs';

const WHO = { male: 'Type 1 (man)', female: 'Type 2 (woman)' };
const VIEWS = [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [-135, 'Rear three-quarter'], [180, 'Back']];
const FAIR = [0.78, 0.6, 0.36];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowponytail')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', ''), who = opt('who', 'male,female').split(',');
  const RIGS = Object.fromEntries(who.map((w) => [w, buildRig(w)]));
  const HAIRS = Object.fromEntries(who.map((w) => [w, buildPonytail(RIGS[w], undefined, { clear: !args.includes('--raw') })]));
  const parts = ['head', 'neck', 'torso', 'joint', 'arm'];
  const said = who.map((w) => `${WHO[w]} ${HAIRS[w].tris.length} triangles`).join(', ');

  for (const mode of ['views', 'wire']) if (only.includes(mode)) {
    const cw = 300, ch = 440, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], hair = HAIRS[w], edges = mode === 'wire';
      VIEWS.forEach(([yaw, label], i) => cells.push({
        meshes: [{ ...bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts }), ...(edges ? { edges: true, edgec: [0.95, 0.85, 0.78] } : {}) }, { ...hairMesh(rig, hair), ...(edges ? { edges: true, edgec: [1, 0.93, 0.85] } : {}) }],
        cam: { yaw, pitch: 0, s: 100, c: [0, 0.35, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}`,
      }));
    });
    await shoot(10 + VIEWS.length * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `ponytail-${mode}${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `High ponytail ${mode === 'wire' ? 'topology' : ''}: ${said}` }] });
  }

  if (only.includes('close')) {
    const cw = 340, ch = 420, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], hair = HAIRS[w];
      [[0, 0, 'Front'], [-30, 0, 'Front three-quarter'], [-90, 0, 'Side'], [180, 0, 'Back'], [150, -35, 'Above, behind']].forEach(([yaw, pitch, label], i) => cells.push({
        meshes: [bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts }), hairMesh(rig, hair)],
        cam: { yaw, pitch, s: 150, c: [0, 1.0, -0.2] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}`,
      }));
    });
    await shoot(10 + 5 * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `ponytail-close${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'High ponytail, close' }] });
  }

  if (only.includes('sheet')) {
    const cw = 260, ch = 400, cells = [];
    let r = 0;
    for (const [col, name] of [[SHEET_HAIR, 'brown'], [FAIR, 'fair']]) for (const w of who) {
      const rig = RIGS[w], hair = HAIRS[w];
      [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [180, 'Back']].forEach(([yaw, label], i) => cells.push({
        meshes: [bodyMesh(rig, hair, rig.B.verts, col, { parts }), hairMesh(rig, hair, hair.verts, col)],
        cam: { yaw, pitch: 0, s: 92, c: [0, 0.4, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}, ${name}`,
      }));
      r++;
    }
    await shoot(10 + 4 * (cw + 8), 34 + r * (ch + 30), cells, join(out, `ponytail-sheet${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `High ponytail: ${said}` }] });
  }

  if (only.includes('poses')) {
    // the test poses, then the clips' poses named by --clips (name:frame, the poses file's $clip)
    const cw = 260, ch = 400, cells = [];
    const want = opt('clips', '').split(',').filter(Boolean);
    who.forEach((w, r) => {
      const rig = RIGS[w], hair = HAIRS[w];
      const file = JSON.parse(readFileSync(new URL(`./hairs/ponytail-poses-${w}.json`, import.meta.url), 'utf8').toString());
      const list = [...Object.entries(POSES), ...want.map((c) => [c, file.find((p) => p.$clip === c)]).filter(([, p]) => p)];
      list.forEach(([name, pose], i) => {
        const f = posed(rig, pose), P = skin(rig, f), H = skinHair(rig, hair, f);
        cells.push({ meshes: [bodyMesh(rig, hair, P, SHEET_HAIR, { parts }), hairMesh(rig, hair, H)], cam: { yaw: -100, pitch: 0, s: 80, c: (({ P: h }) => [h[0], h[1] - 0.6, h[2]])(f[rig.at.get('head')]) }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${name}` });
      });
    });
    const n = Math.max(...who.map((w) => cells.filter((c) => c.label.startsWith(WHO[w])).length));
    await shoot(10 + n * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `ponytail-poses${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'High ponytail posed (from the side, behind)' }] });
  }

  if (only.includes('hat')) {
    const { buildHat, hatHair } = await import('./garments/hat.mjs');
    const cw = 380, ch = 440, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], G = buildHat(rig), H = hatHair(rig, G, { style: 'ponytail' });
      const hat = { who: w, P: G.verts, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => (p.piece === 'feather' ? [0.85, 0.8, 0.7] : p.mat === 'trim' ? [0.55, 0.42, 0.25] : [0.45, 0.3, 0.2])) };
      const hair = { ...H, polys: H.polys.map((v, i) => ({ v, valley: H.mat[i] > 4 ? H.mat[i] - 4 : 0 })), tris: H.tris.map((t) => [...t.v, t.poly]) };
      [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [180, 'Back']].forEach(([yaw, label], i) => cells.push({
        meshes: [bodyMesh(rig, { shave: H.shave }, rig.B.verts, SHEET_HAIR, { parts }), hairMesh(rig, hair), hat],
        cam: { yaw, pitch: 0, s: 80, c: [0, 0.75, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}: ${H.pressed.length} pressed, ${H.hatCross} through the hat`,
      }));
    });
    await shoot(10 + 4 * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `ponytail-hat${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'High ponytail under the leather hat (hatHair)' }] });
  }
  await closeBrowser();
}
