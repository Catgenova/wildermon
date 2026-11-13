// The afro's review sheets (tools/sculpt/lowafro.mjs on the low-poly bodies), drawn by tools/sculpt/lowhairshot.mjs shoot.
//
//   node tools/sculpt/lowafroshot.mjs --out <dir> [--tag -x] [--who female,male] [--only views,wire,sheet,close,hat]
// views: per body the front, three-quarter, side and back (afro-views-<who>.png); wire: the topology, both bodies
// (afro-wire.png); sheet: both bodies, four views, in two hair colours (afro-sheet.png); close: the lower edge over the
// ear and the nape, larger (afro-close.png).
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { afroOf } from './lowafro.mjs';

const WHO = { female: 'Type 2 (woman)', male: 'Type 1 (man)' };
const VIEWS = [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [180, 'Back']];
/** A second hair colour for the sheet: near black. */
const DARK_HAIR = [0.16, 0.11, 0.1];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowafro')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', ''), who = opt('who', 'female,male').split(',');
  const RIGS = Object.fromEntries(who.map((w) => [w, buildRig(w)])), HAIRS = Object.fromEntries(who.map((w) => [w, afroOf(RIGS[w])]));
  const head = (w, hair, col = SHEET_HAIR) => [bodyMesh(RIGS[w], hair, RIGS[w].B.verts, col, { parts: ['head', 'neck', 'torso'] }), hairMesh(RIGS[w], hair, hair.verts, col)];

  if (only.includes('views')) for (const w of who) {
    const hair = HAIRS[w], cw = 360, ch = 420;
    const cells = VIEWS.map(([yaw, label], i) => ({ meshes: head(w, hair), cam: { yaw, pitch: 0, s: 115, c: [0, 1.25, 0] }, box: [10 + i * (cw + 8), 34, cw, ch], label }));
    await shoot(4 * cw + 44, ch + 44, cells, join(out, `afro-views-${w}${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Afro, ${WHO[w]}: ${hair.tris.length} triangles` }] });
  }

  if (only.includes('wire')) {
    const cw = 330, ch = 380, cells = [];
    who.forEach((w, r) => VIEWS.forEach(([yaw, label], i) => {
      const [b, h] = head(w, HAIRS[w]);
      cells.push({ meshes: [{ ...b, edges: true, edgec: [0.95, 0.85, 0.78] }, { ...h, edges: true, edgec: [1, 0.93, 0.85] }], cam: { yaw, pitch: 0, s: 105, c: [0, 1.25, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 8), cw, ch], label: `${WHO[w]} ${label}` });
    }));
    await shoot(4 * cw + 44, who.length * (ch + 8) + 44, cells, join(out, `afro-wire${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Afro topology: ${who.map((w) => `${WHO[w]} ${HAIRS[w].tris.length} triangles`).join(', ')}; one closed shell` }] });
  }

  if (only.includes('sheet')) {
    const cw = 300, ch = 340, cells = [];
    let r = 0;
    for (const col of [SHEET_HAIR, DARK_HAIR]) for (const w of who) {
      VIEWS.forEach(([yaw, label], i) => cells.push({ meshes: head(w, HAIRS[w], col), cam: { yaw, pitch: 0, s: 95, c: [0, 1.25, 0] }, box: [10 + i * (cw + 8), 34 + r * (ch + 8), cw, ch], label: `${WHO[w]} ${label}` }));
      r++;
    }
    await shoot(4 * cw + 44, r * (ch + 8) + 44, cells, join(out, `afro-sheet${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Afro on both bodies: the sheet brown (top), near black (below)' }] });
  }

  if (only.includes('close')) {
    const cw = 420, ch = 380, cells = [];
    who.forEach((w, r) => [[-90, 'Side, the lower edge over the ear', [0, 1.2, -0.1]], [-140, 'Rear three-quarter, the nape', [0, 1.0, -0.2]], [-20, 'Front, the hairline', [0, 1.5, 0.3]], [-50, 'From below', [0, 1.3, 0], 30]].forEach(([yaw, label, c, pitch = 0], i) => {
      cells.push({ meshes: head(w, HAIRS[w]), cam: { yaw, pitch, s: 170, c }, box: [10 + i * (cw + 8), 34 + r * (ch + 8), cw, ch], label: `${WHO[w]} ${label}` });
    }));
    await shoot(4 * cw + 44, who.length * (ch + 8) + 44, cells, join(out, `afro-close${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Afro close: the lower edge, the nape, the hairline' }] });
  }
  if (only.includes('hat')) {
    // the leather hat (src/sculpt/assets/lowhat-<who>.json) and the afro pressed under it (its `hair.afro`)
    const cw = 330, ch = 380, cells = [], tri4 = (t) => Array.from({ length: t.length / 4 }, (_, i) => t.slice(i * 4, i * 4 + 4));
    who.forEach((w, r) => {
      const A = JSON.parse(readFileSync(new URL(`../../src/sculpt/assets/lowhat-${w}.json`, import.meta.url), 'utf8')), h = A.hair.afro;
      const P3 = (f) => Array.from({ length: f.length / 3 }, (_, i) => f.slice(i * 3, i * 3 + 3));
      const hatM = { who: w, P: P3(A.verts), polys: A.polys.map((p) => p[0]), tris: tri4(A.tris), col: A.polys.map((p) => A.colours[p[1]]) };
      const pressed = { verts: P3(h.verts), polys: h.polys.map((v, i) => ({ v, ...(h.mat[i] > 4 ? { valley: h.mat[i] - 4 } : {}) })), tris: tri4(h.tris), shave: h.shave };
      // (level, and from above as the game's camera looks)
      for (const [k, pitch] of [[0, 0], [1, -35]]) VIEWS.forEach(([yaw, label], i) => cells.push({ meshes: [...head(w, pressed), hatM], cam: { yaw, pitch, s: 105, c: [0, 1.3, 0] }, box: [10 + i * (cw + 8), 34 + (2 * r + k) * (ch + 8), cw, ch], label: `${WHO[w]} ${label}${pitch ? ', from above' : ''}` }));
    });
    await shoot(4 * cw + 44, 2 * who.length * (ch + 8) + 44, cells, join(out, `afro-hat${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Afro pressed under the leather hat (tools/sculpt/garments/hat.mjs hatHair)' }] });
  }
  await closeBrowser();
}
