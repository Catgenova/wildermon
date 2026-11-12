// The bob's review sheets (tools/sculpt/lowbob.mjs on the low-poly bodies), drawn by tools/sculpt/lowhairshot.mjs shoot.
//
//   node tools/sculpt/lowbobshot.mjs --out <dir> [--tag -x] [--who female,male] [--only cams,views,hull,close,wire,turn]
// cams: each body's head and neck under the sheet's cameras over the sheet; views: per body the sheet's row, ours under
// each view's camera, ours over the sheet in a see-through teal with the IoU per view; hull: the same with the carved
// hull in the hair's place; close: the five views larger, the sheet's beside ours; wire: the topology; turn: the hair
// turning round the head in eight steps, each body.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { bobOf, hullOf, outlineIoU, tri3 } from './lowbob.mjs';
import { hullMesh } from './lowbraid.mjs';
import { bobCams, bodyAt } from './lowbobcams.mjs';
import { PIV } from './lowhairhull.mjs';

const DIR = new URL('.', import.meta.url).pathname;
export const REF = join(DIR, 'ref/hair-bob.png'), REF_SIZE = [1448, 492];
export const LABELS = [['front', 'Front (0°)'], ['q3', 'Three-quarter (45°)'], ['profile', 'Profile (90°)'], ['r3', 'Rear three-quarter (135°)'], ['back', 'Back (180°)']];
/** The renderer's camera for a sheet camera, `k` times larger, its middle `dy` sheet pixels under the pivot's row. */
export const camOf = (c, k = 1, dy = 0) => ({ yaw: -c.yaw, pitch: -c.pitch, s: c.s * k, c: [PIV[0], PIV[1] + dy / c.s, PIV[2]] });
const TEAL = [0.2, 0.95, 0.85];
const WHO = { female: 'Type 2 (woman)', male: 'Type 1 (man)' };

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowbob')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', ''), who = opt('who', 'female,male').split(',');
  const cw = 270, ch = 330, gap = 8, x0 = 10, ROW = 215;
  const RIGS = Object.fromEntries(who.map((w) => [w, buildRig(w)]));
  const HAIRS = Object.fromEntries(who.map((w) => [w, only.includes('hull') ? { ...hullMesh(hullOf(RIGS[w]).H, 1), shave: [] } : bobOf(RIGS[w])]));

  if (only.includes('cams')) for (const w of who) {
    const rig = RIGS[w], C = bobCams(w), bare = { shave: [] }, cells = [], imgs = [], y1 = 34, y2 = y1 + ch + 22;
    LABELS.forEach(([v, label], i) => {
      const c = C[v], x = x0 + i * (cw + gap), crop = [c.cx - cw / 2, ROW - ch / 2, cw, ch], dy = c.cy - ROW;
      imgs.push({ src: REF, size: REF_SIZE, crop, box: [x, y1, cw, ch] }, { src: REF, size: REF_SIZE, crop, box: [x, y2, cw, ch] });
      const body = bodyMesh(rig, bare, rig.B.verts.map(bodyAt(c)), SHEET_HAIR, { parts: ['head', 'neck', 'torso'] });
      cells.push({ meshes: [{ ...body, alpha: 0.55 }], cam: camOf(c, 1, dy), box: [x, y2, cw, ch], see: true, label: `${label}: yaw ${c.yaw}°` });
    });
    await shoot(x0 * 2 + 5 * cw + 4 * gap, y2 + ch + 10, cells, join(out, `bob-cams-${w}${tag}.png`), { imgs, texts: [{ css: 'left:12px;top:6px', html: `Bob sheet: the cameras registered to the ${WHO[w]} head and neck (below: the body over the sheet)` }] });
  }

  if (only.includes('views') || only.includes('hull')) for (const w of who) {
    const rig = RIGS[w], hair = HAIRS[w], iou = outlineIoU(tri3(hair), w), C = bobCams(w);
    const cells = [], imgs = [], y1 = 34, y2 = y1 + ch + 22, y3 = y2 + ch + 22;
    LABELS.forEach(([v, label], i) => {
      const c = C[v], x = x0 + i * (cw + gap), crop = [c.cx - cw / 2, ROW - ch / 2, cw, ch], dy = c.cy - ROW, st = bodyAt(c);
      imgs.push({ src: REF, size: REF_SIZE, crop, box: [x, y1, cw, ch] }, { src: REF, size: REF_SIZE, crop, box: [x, y3, cw, ch] });
      const Pw = rig.B.verts.map(st), Hw = hair.verts.map(st);
      cells.push({ meshes: [bodyMesh(rig, hair, Pw, SHEET_HAIR, { parts: ['head', 'neck', 'torso'] }), hairMesh(rig, hair, Hw)], cam: camOf(c, 1, dy), box: [x, y2, cw, ch], label });
      cells.push({ meshes: [{ ...bodyMesh(rig, hair, Pw, SHEET_HAIR, { parts: ['head', 'neck', 'torso'] }), depthOnly: true }, { ...hairMesh(rig, hair, Hw), col: hair.polys.map(() => TEAL), flat: true, alpha: 0.42 }],
        cam: camOf(c, 1, dy), box: [x, y3, cw, ch], see: true, label: `IoU ${iou[v].iou.toFixed(3)}` });
    });
    const mean = (Object.values(iou).reduce((a, d) => a + d.iou, 0) / 5).toFixed(3);
    await shoot(x0 * 2 + 5 * cw + 4 * gap, y3 + ch + 10, cells, join(out, `bob-${only.includes('hull') ? 'hull' : 'sheet'}-${w}${tag}.png`), {
      imgs, texts: [{ css: 'left:12px;top:6px', html: `Bob — the sheet (top), ${WHO[w]} (middle), ours over the sheet (bottom): ${hair.tris.length} triangles; IoU mean ${mean}` }] });
    console.log(w, 'IoU', JSON.stringify(iou));
  }

  if (only.includes('close')) for (const w of who) {
    const rig = RIGS[w], hair = HAIRS[w], C = bobCams(w), K = 1.6, cw2 = 380, ch2 = 420, cells = [], imgs = [];
    LABELS.forEach(([v, label], i) => {
      const c = C[v], x = 10 + i * (cw2 + gap), cy = 225, st = bodyAt(c);
      imgs.push({ src: REF, size: REF_SIZE, crop: [c.cx - cw2 / K / 2, cy - ch2 / K / 2, cw2 / K, ch2 / K], box: [x, 34, cw2, ch2] });
      cells.push({ meshes: [bodyMesh(rig, hair, rig.B.verts.map(st), SHEET_HAIR, { parts: ['head', 'neck', 'torso'] }), hairMesh(rig, hair, hair.verts.map(st))], cam: camOf(c, K, c.cy - cy), box: [x, 34 + ch2 + gap, cw2, ch2], label });
    });
    await shoot(10 + 5 * (cw2 + gap), 34 + 2 * (ch2 + gap), cells, join(out, `bob-close-${w}${tag}.png`), { imgs, texts: [{ css: 'left:12px;top:6px', html: `Bob close: the sheet (top), ${WHO[w]} (bottom)` }] });
  }

  if (only.includes('fringe')) for (const w of who) {
    // the fringe close: the sheet's (top) beside ours (bottom), front, three-quarter and profile, the band round the cut
    const rig = RIGS[w], hair = HAIRS[w], C = bobCams(w), K = 4, cw2 = 480, ch2 = 360, cells = [], imgs = [];
    const FB = JSON.parse((await import('node:fs')).readFileSync(new URL('./hairs/bob-sheet.json', import.meta.url), 'utf8')).marks.fringe;
    LABELS.filter(([v]) => FB[v]).forEach(([v, label], i) => {
      const c = C[v], x = 10 + i * (cw2 + gap), fx = (FB[v].columns[0] + FB[v].columns[1]) / 2, fy = FB[v].cut - 15, st = bodyAt(c);
      imgs.push({ src: REF, size: REF_SIZE, crop: [fx - cw2 / K / 2, fy - ch2 / K / 2, cw2 / K, ch2 / K], box: [x, 34, cw2, ch2] });
      // (the plain camera's middle moved to the crop's middle: across by the pivot's column, down by its row)
      const cam = camOf(c, K, c.cy - fy), dx = (fx - c.cx) / c.s, a = (c.yaw * Math.PI) / 180;
      cam.c = [cam.c[0] + dx * Math.cos(a), cam.c[1], cam.c[2] + dx * Math.sin(a)];
      cells.push({ meshes: [bodyMesh(rig, hair, rig.B.verts.map(st), SHEET_HAIR, { parts: ['head', 'neck', 'torso'] }), hairMesh(rig, hair, hair.verts.map(st))], cam, box: [x, 34 + ch2 + gap, cw2, ch2], label });
    });
    await shoot(10 + 3 * (cw2 + gap), 34 + 2 * (ch2 + gap), cells, join(out, `bob-fringe-${w}${tag}.png`), { imgs, texts: [{ css: 'left:12px;top:6px', html: `Bob fringe close: the sheet (top), ${WHO[w]} (bottom)` }] });
  }

  if (only.includes('wire')) for (const w of who) {
    const rig = RIGS[w], hair = HAIRS[w], cw2 = 330, ch2 = 420;
    const cells = [[0, 'Front'], [-45, 'Three-quarter'], [-90, 'Profile'], [180, 'Back']].map(([yaw, label], i) => ({ meshes: [{ ...bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts: ['head', 'neck', 'torso'] }), edges: true, edgec: [0.95, 0.85, 0.78] }, { ...hairMesh(rig, hair), edges: true, edgec: [1, 0.93, 0.85] }], cam: { yaw, pitch: 0, s: 120, c: [0, 0.9, 0] }, box: [10 + i * (cw2 + 8), 34, cw2, ch2], label }));
    await shoot(4 * cw2 + 44, ch2 + 44, cells, join(out, `bob-wire-${w}${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Bob topology, ${WHO[w]}: ${hair.tris.length} triangles, one closed shell` }], imgs: [] });
  }
  await closeBrowser();
}
