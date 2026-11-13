// Long waves' review sheets (tools/sculpt/lowwaves.mjs on the low-poly bodies), drawn by tools/sculpt/lowhairshot.mjs
// shoot (after tools/sculpt/lowwarriorshot.mjs).
//
//   node tools/sculpt/lowwavesshot.mjs --out <dir> [--tag -x] [--who female,male] [--only views,wire,close,posed,hat,sheet] [--noclear]
// views: per body front, three-quarter, side, back and the rear three-quarter, down to the waist; wire: the same with
// every polygon's outline; close: the head larger; posed: the hair in the clips' poses that bend the head and raise the
// arms (the swing, the ground, drinking), front and side; hat: pressed under the leather hat (tools/sculpt/garments/hat.mjs
// hatHair, read from src/sculpt/assets/lowhair.json); sheet: both bodies, the four views, in two hair colours.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig, posed, skin, add } from './lowrig.mjs';
import { skinHair } from './lowhair.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { buildWaves, posesOf, crossReport } from './lowwaves.mjs';
import WAVES from './hairs/waves.mjs';

const WHO = { female: 'Type 2 (woman)', male: 'Type 1 (man)' };
const VIEWS = [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [-135, 'Rear three-quarter'], [180, 'Back']];
const FAIR = [0.78, 0.6, 0.36];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowwaves')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', ''), who = opt('who', 'female,male').split(',');
  const RIGS = Object.fromEntries(who.map((w) => [w, buildRig(w)]));
  const HAIRS = Object.fromEntries(who.map((w) => [w, buildWaves(RIGS[w], WAVES, { clear: !args.includes('--noclear') })]));
  const parts = ['head', 'neck', 'torso', 'joint', 'arm', 'hand', 'pelvis'];
  const said = who.map((w) => `${WHO[w]} ${HAIRS[w].tris.length} triangles`).join(', ');

  for (const mode of ['views', 'wire']) if (only.includes(mode)) {
    const cw = 300, ch = 460, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], hair = HAIRS[w], edges = mode === 'wire';
      VIEWS.forEach(([yaw, label], i) => cells.push({
        meshes: [{ ...bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts }), ...(edges ? { edges: true, edgec: [0.95, 0.85, 0.78] } : {}) }, { ...hairMesh(rig, hair), ...(edges ? { edges: true, edgec: [1, 0.93, 0.85] } : {}) }],
        cam: { yaw, pitch: 0, s: 80, c: [0, -0.4, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}`,
      }));
    });
    await shoot(10 + VIEWS.length * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `waves-${mode}${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Long waves ${mode === 'wire' ? 'topology' : ''}: ${said}` }] });
  }

  if (only.includes('close')) {
    const cw = 360, ch = 420, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], hair = HAIRS[w];
      [[0, 0, 'Front'], [-30, 0, 'Front three-quarter'], [-90, 0, 'Side'], [180, 0, 'Back'], [0, -40, 'From above']].forEach(([yaw, pitch, label], i) => cells.push({
        meshes: [bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts }), hairMesh(rig, hair)],
        cam: { yaw, pitch, s: 140, c: [0, 0.6, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}`,
      }));
    });
    await shoot(10 + 5 * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `waves-close${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Long waves, close' }] });
  }

  if (only.includes('posed')) {
    // the clips' poses that try the hair hardest: the swing's arms overhead, the ground and drinking (head down), the walk
    const want = opt('poses', 'swing 6,swing 12,ground 6,drink-cup 6,drink-skin 6,walk 6').split(',');
    const cw = 250, ch = 400, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], hair = HAIRS[w], all = posesOf(w);
      want.forEach((name, i) => {
        const pose = all.find((p) => p.$clip === name);
        if (!pose) return;
        const f = posed(rig, pose), P = skin(rig, f), H = skinHair(rig, hair, f), x = crossReport(rig, hair, P, H), n = Object.values(x).reduce((a, b) => a + b, 0);
        for (const [k, [yaw, lab]] of [[-20, 'front'], [-100, 'side']].entries()) cells.push({
          meshes: [bodyMesh(rig, hair, P, SHEET_HAIR, { parts }), hairMesh(rig, hair, H)],
          cam: { yaw, pitch: 0, s: 60, c: add(f[rig.at.get("head")].P, [0, -1.6, 0]) }, box: [10 + (i * 2 + k) * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${w} ${name} ${lab}: ${n}`,
        });
      });
    });
    await shoot(10 + want.length * 2 * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `waves-posed${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Long waves in the clips\' poses' }] });
  }

  if (only.includes('sheet')) {
    const cw = 260, ch = 420, cells = [];
    let r = 0;
    for (const [col, name] of [[SHEET_HAIR, 'brown'], [FAIR, 'fair']]) for (const w of who) {
      const rig = RIGS[w], hair = HAIRS[w];
      [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [180, 'Back']].forEach(([yaw, label], i) => cells.push({
        meshes: [bodyMesh(rig, hair, rig.B.verts, col, { parts }), hairMesh(rig, hair, hair.verts, col)],
        cam: { yaw, pitch: 0, s: 72, c: [0, -0.5, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}, ${name}`,
      }));
      r++;
    }
    await shoot(10 + 4 * (cw + 8), 34 + r * (ch + 30), cells, join(out, `waves-sheet${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Long waves: ${said}` }] });
  }

  if (only.includes('hat')) {
    const { buildHat, hatHair } = await import('./garments/hat.mjs');
    const cw = 330, ch = 460, cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], G = buildHat(rig), H = hatHair(rig, G, { style: 'waves' });
      const hat = { who: w, P: G.verts, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => (p.piece === 'feather' ? [0.85, 0.8, 0.7] : p.mat === 'trim' ? [0.55, 0.42, 0.25] : [0.45, 0.3, 0.2])) };
      const hair = { ...H, polys: H.polys.map((v, i) => ({ v, valley: H.mat[i] > 4 ? H.mat[i] - 4 : 0 })), tris: H.tris.map((t) => [...t.v, t.poly]) };
      [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [180, 'Back']].forEach(([yaw, label], i) => cells.push({
        meshes: [bodyMesh(rig, { shave: H.shave }, rig.B.verts, SHEET_HAIR, { parts }), hairMesh(rig, hair), hat],
        cam: { yaw, pitch: 0, s: 100, c: [0, 0.2, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 30), cw, ch], label: `${WHO[w]} ${label}: ${H.pressed.length} pressed, ${H.hatCross} through the hat`,
      }));
    });
    await shoot(10 + 4 * (cw + 8), 34 + who.length * (ch + 30), cells, join(out, `waves-hat${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Long waves under the leather hat (hatHair)' }] });
  }
  await closeBrowser();
}
