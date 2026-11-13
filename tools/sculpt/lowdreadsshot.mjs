// The dreads' review sheets (tools/sculpt/lowdreads.mjs on the low-poly bodies), drawn by tools/sculpt/lowhairshot.mjs
// shoot: both bodies, front, three-quarter, side and back.
//
//   node tools/sculpt/lowdreadsshot.mjs --out <dir> [--tag -x] [--who female,male] [--only views,wire,hat,close]
//     [--colours brown,blond]
// views: per body and hair colour the four views (dreads-views<tag>.png); wire: the topology (dreads-wire<tag>.png);
// hat: under the leather hat, pressed (tools/sculpt/garments/hat.mjs hatHair, from src/sculpt/assets/lowhair.json:
// dreads-hat<tag>.png); close: the heads larger, front, three-quarter, side, rear three-quarter, back, top
// (dreads-close<tag>.png).
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { dreadsOf } from './lowdreads.mjs';

const WHO = { female: 'Type 2 (woman)', male: 'Type 1 (man)' };
/** The hair colours shown: the sheets' brown, a sandy blond, a near black. */
const COLOURS = { brown: SHEET_HAIR, blond: [0.72, 0.55, 0.34], black: [0.16, 0.12, 0.11] };
const VIEWS = [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Side'], [180, 'Back']];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowdreads')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', ''), who = opt('who', 'female,male').split(','), colours = opt('colours', 'brown,blond').split(',');
  const RIGS = Object.fromEntries(who.map((w) => [w, buildRig(w)]));
  const HAIRS = Object.fromEntries(who.map((w) => [w, dreadsOf(RIGS[w])]));
  const cw = 330, ch = 420, gap = 8;

  if (only.includes('views') || only.includes('wire')) for (const kind of ['views', 'wire'].filter((k) => only.includes(k))) {
    const cells = [], rows = [];
    for (const w of who) for (const cn of kind === 'wire' ? ['brown'] : colours) rows.push([w, cn]);
    rows.forEach(([w, cn], r) => {
      const rig = RIGS[w], hair = HAIRS[w], col = COLOURS[cn], y = 34 + r * (ch + gap);
      VIEWS.forEach(([yaw, label], i) => {
        const body = bodyMesh(rig, hair, rig.B.verts, col, { parts: ['head', 'neck', 'torso', 'joint', 'arm'] }), hm = hairMesh(rig, hair, hair.verts, col);
        const e = kind === 'wire' ? { edges: true, edgec: [1, 0.93, 0.85] } : {};
        cells.push({ meshes: [{ ...body, ...(kind === 'wire' ? { edges: true, edgec: [0.95, 0.85, 0.78] } : {}) }, { ...hm, ...e }], cam: { yaw, pitch: 0, s: 120, c: [0, 0.75, 0] }, box: [10 + i * (cw + gap), y, cw, ch], label: `${w === 'female' ? 'Woman' : 'Man'}, ${cn}: ${label}` });
      });
    });
    const tri = who.map((w) => `${WHO[w]} ${HAIRS[w].tris.length}`).join(', ');
    await shoot(10 + 4 * (cw + gap), 34 + rows.length * (ch + gap), cells, join(out, `dreads-${kind}${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Dreads ${kind === 'wire' ? 'topology' : ''}: ${HAIRS[who[0]].pieces.length} locks; triangles ${tri}` }] });
  }

  if (only.includes('close')) {
    const cells = [], K = 1.35, cw2 = 300, ch2 = 360;
    const V2 = [[0, 0, 'Front'], [-45, 0, 'Three-quarter'], [-90, 0, 'Side'], [-135, 0, 'Rear three-quarter'], [180, 0, 'Back'], [0, -70, 'From above'], [0, -89, 'Top down']];
    who.forEach((w, r) => {
      const rig = RIGS[w], hair = HAIRS[w];
      V2.forEach(([yaw, pitch, label], i) => cells.push({ meshes: [bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts: ['head', 'neck', 'torso', 'joint'] }), hairMesh(rig, hair)], cam: { yaw, pitch, s: 120 * K, c: [0, 0.95, 0] }, box: [10 + i * (cw2 + gap), 34 + r * (ch2 + gap), cw2, ch2], label: `${w === 'female' ? 'Woman' : 'Man'}: ${label}` }));
    });
    await shoot(10 + V2.length * (cw2 + gap), 34 + who.length * (ch2 + gap), cells, join(out, `dreads-close${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Dreads close' }] });
  }

  if (only.includes('hat')) {
    // (the hat and the hair pressed under it as tools/sculpt/garments/hat.mjs writes them for the game)
    const { buildHat, hatHair, MATS } = await import('./garments/hat.mjs');
    const cells = [];
    who.forEach((w, r) => {
      const rig = RIGS[w], G = buildHat(rig), H = hatHair(rig, G, { style: 'dreads' });
      console.log(w, 'under the hat:', H.pressed.length, 'of', H.verts.length, 'vertices pressed, least room', H.room?.toFixed(3), H.hatCross, 'crossing the hat');
      // (its triangles { v, poly }; a valley's material 4 + its step, marked as tools/sculpt/lowhairshot.mjs hairMesh marks it)
      const hair = { ...HAIRS[w], shave: H.shave }, hm = { who: w, P: H.verts, polys: H.polys, tris: H.tris.map((t) => [...t.v, t.poly]), col: H.mat.map((m) => SHEET_HAIR.map((x, c) => -x - (m > 4 && !c ? 10 * (m - 4) : 0))) };
      const hat = { who: w, P: G.verts, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => MATS[p.mat] ?? MATS.leather) };
      VIEWS.forEach(([yaw, label], i) => cells.push({ meshes: [bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts: ['head', 'neck', 'torso', 'joint', 'arm'] }), hm, hat], cam: { yaw, pitch: 0, s: 120, c: [0, 0.85, 0] }, box: [10 + i * (cw + gap), 34 + r * (ch + gap), cw, ch], label: `${w === 'female' ? 'Woman' : 'Man'}, leather hat: ${label}` }));
    });
    await shoot(10 + 4 * (cw + gap), 34 + who.length * (ch + gap), cells, join(out, `dreads-hat${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Dreads pressed under the leather hat' }] });
  }
  await closeBrowser();
}
