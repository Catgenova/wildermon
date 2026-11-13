// The crown braid's review sheets (tools/sculpt/lowcrownbraid.mjs on the low-poly bodies), drawn by
// tools/sculpt/lowhairshot.mjs shoot (after tools/sculpt/lowtopknotshot.mjs): each body's head and shoulders from the
// front, the three-quarter, the side and the back (and from above behind), in the hair's colours; close; the topology;
// the hair under the leather hat (tools/sculpt/garments/hat.mjs hatHair); the final sheet.
//
//   node tools/sculpt/lowcrownbraidshot.mjs --out <dir> [--tag -x] [--who male,female] [--only views,close,wire,hat,sheet]
//     views: <dir>/crownbraid-views<tag>.png; close: crownbraid-close<tag>.png; wire: crownbraid-wire<tag>.png;
//     hat: crownbraid-hat<tag>.png (pressed under the hat: the hat on, and left out; reads the game's copy,
//     src/sculpt/assets/lowhair.json); sheet: crownbraid-sheet<tag>.png (both bodies, four views, two hair colours)
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { buildCrownbraid } from './lowcrownbraid.mjs';

const WHO = { male: 'Type 1 (man)', female: 'Type 2 (woman)' };
const VIEWS = [[0, 0, 'Front'], [-45, 0, 'Three-quarter'], [-90, 0, 'Side'], [180, 0, 'Back'], [150, -35, 'Above, behind']];
/** A second hair colour for the final sheet: a pale ash blond (the reviews' colours). */
const BLOND = [0.78, 0.66, 0.45];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowcrownbraid')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', ''), who = opt('who', 'male,female').split(',');
  const RIGS = Object.fromEntries(who.map((w) => [w, buildRig(w)]));
  const HAIRS = Object.fromEntries(who.map((w) => [w, buildCrownbraid(RIGS[w])]));
  const cw = 300, ch = 330, gap = 6, top = 34;
  const cam = (yaw, pitch, k = 1) => ({ yaw, pitch, s: 125 * k, c: [0, 1.15, -0.05] });
  const part = { parts: ['head', 'neck', 'torso'] };
  const grid = (name, title, camOf, meshesOf, views = VIEWS) => {
    const cells = [];
    who.forEach((w, r) => views.forEach(([yaw, pitch, label], i) => cells.push({ meshes: meshesOf(w), cam: camOf(yaw, pitch), box: [10 + i * (cw + gap), top + r * (ch + gap), cw, ch], label: `${WHO[w]}: ${label}` })));
    return shoot(20 + views.length * (cw + gap), top + who.length * (ch + gap) + 6, cells, join(out, `crownbraid-${name}${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: title }] });
  };
  const tris = who.map((w) => `${WHO[w]} ${HAIRS[w].tris.length} triangles`).join(', ');
  if (only.includes('views')) await grid('views', `Crown braid: ${tris}`, cam, (w) => [bodyMesh(RIGS[w], HAIRS[w], RIGS[w].B.verts, SHEET_HAIR, part), hairMesh(RIGS[w], HAIRS[w])]);
  if (only.includes('close')) await grid('close', 'Crown braid, close', (yaw, pitch) => ({ yaw, pitch, s: 230, c: [0, 1.72, -0.15] }), (w) => [bodyMesh(RIGS[w], HAIRS[w], RIGS[w].B.verts, SHEET_HAIR, part), hairMesh(RIGS[w], HAIRS[w])]);
  if (only.includes('wire')) {
    const pcs = (w) => { const h = HAIRS[w], n = (kind) => h.pieces.filter((p) => p.kind === kind).reduce((a, p) => a + p.polys[1] - p.polys[0], 0); return `${WHO[w]} comb ${n('shell')}, braid ${n('braid')} polygons`; };
    await grid('wire', `Crown braid topology: ${who.map(pcs).join('; ')}`, (yaw, pitch) => ({ yaw, pitch, s: 230, c: [0, 1.72, -0.15] }), (w) => [{ ...bodyMesh(RIGS[w], HAIRS[w], RIGS[w].B.verts, SHEET_HAIR, part), edges: true, edgec: [0.95, 0.85, 0.78] }, { ...hairMesh(RIGS[w], HAIRS[w]), edges: true, edgec: [1, 0.93, 0.85] }]);
  }
  if (only.includes('sheet')) {
    const cells = [];
    let r = 0;
    for (const w of who) for (const [col, name] of [[SHEET_HAIR, 'brown'], [BLOND, 'ash blond']]) {
      const rig = RIGS[w], hair = HAIRS[w];
      VIEWS.slice(0, 4).forEach(([yaw, pitch, label], i) => cells.push({ meshes: [bodyMesh(rig, hair, rig.B.verts, col, part), hairMesh(rig, hair, hair.verts, col)], cam: cam(yaw, pitch), box: [10 + i * (cw + gap), top + r * (ch + gap), cw, ch], label: `${WHO[w]}, ${name}: ${label}` }));
      r++;
    }
    await shoot(20 + 4 * (cw + gap), top + r * (ch + gap) + 6, cells, join(out, `crownbraid-sheet${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Crown braid: ${tris}` }] });
  }
  if (only.includes('hat')) {
    const { buildHat, hatHair } = await import('./garments/hat.mjs');
    const HAIR = JSON.parse(readFileSync(new URL('../../src/sculpt/assets/lowhair.json', import.meta.url), 'utf8'));
    const cells = [];
    who.forEach((w, r) => {
      if (!HAIR[w].crownbraid) throw new Error('no crownbraid in src/sculpt/assets/lowhair.json');
      const rig = RIGS[w], G = buildHat(rig), H = hatHair(rig, G, { style: 'crownbraid' });
      const pressed = { verts: H.verts, polys: H.polys.map((v, i) => ({ v, valley: H.mat[i] >= 5 ? H.mat[i] - 4 : 0, buzz: H.mat[i] === 3 })), tris: H.tris.map((t) => [...t.v, t.poly]), shave: H.shave };
      const hat = { who: w, P: G.verts, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map(() => [0.42, 0.22, 0.18]) };
      VIEWS.slice(0, 4).forEach(([yaw, pitch, label], i) => {
        const x = 10 + i * (cw + gap);
        cells.push({ meshes: [bodyMesh(rig, pressed, rig.B.verts, SHEET_HAIR, part), hairMesh(rig, pressed), hat], cam: cam(yaw, pitch, 0.8), box: [x, top + 2 * r * (ch + gap), cw, ch], label: `${WHO[w]}: ${label}, hat on` });
        cells.push({ meshes: [bodyMesh(rig, pressed, rig.B.verts, SHEET_HAIR, part), hairMesh(rig, pressed)], cam: cam(yaw, pitch, 0.8), box: [x, top + (2 * r + 1) * (ch + gap), cw, ch], label: `hat off: ${H.pressed.length}/${H.verts.length} pressed, ${H.hatCross} through the hat` });
      });
    });
    await shoot(20 + 4 * (cw + gap), top + 2 * who.length * (ch + gap) + 6, cells, join(out, `crownbraid-hat${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Crown braid under the leather hat (pressed under it): the hat on, and the pressed hair with the hat left out' }] });
  }
  await closeBrowser();
}
