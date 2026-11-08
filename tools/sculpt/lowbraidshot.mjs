// The side braid's review sheets (tools/sculpt/lowbraid.mjs on the low-poly bodies), drawn by tools/sculpt/lowhairshot.mjs
// shoot: per view the reference sheet's row (tools/sculpt/ref/hair-side-braid.png), ours under that view's camera
// (tools/sculpt/hairs/braid-cams.json), and ours over the sheet in a see-through teal, with the outline difference
// (tools/sculpt/lowbraid.mjs outlineDiff) per view.
//
//   node tools/sculpt/lowbraidshot.mjs --out <dir> [--tag -x] [--who female,male]
//        [--only cams,hull,views,close,rear,joints,pieces,turn,wire,sil,exploded,game,shawl]
// cams: the cameras' registration (her head and neck over the sheet's skin and hair silhouettes); hull: the carved hull
// in place of the hair; views: the sheet, ours, ours over the sheet; close: the views larger; rear: the profile, the
// rear three-quarter and the back larger, with ours per piece over the sheet; pieces: per piece over the sheet; joints:
// the braid's joints and its rest on the shoulder close; turn: the head turned 70°
// and nodded 40°, the idle and the walk, crossings counted; wire: the topology; sil: the silhouette; exploded: the pieces
// pulled apart; game: the full bodies at the game's zooms 5 and 10; shawl: the braid over the outfit's shawl.
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { carve, hullMesh, outlineDiff, bodyTris, buildBraid } from './lowbraid.mjs';
import { warpOf } from './lowhairhull.mjs';

const DIR = new URL('.', import.meta.url).pathname;
export const REF = join(DIR, 'ref/hair-side-braid.png'), REF_SIZE = [1536, 1024], MASK = join(DIR, 'hairs/braid-mask.png');
const PIV = [0, 1, 0.1];
export const LABELS = [['front', 'Front (0°)'], ['q3', 'Three-quarter (45°)'], ['profile', 'Profile (90°)'], ['r3', 'Rear three-quarter (135°)'], ['back', 'Back (180°)']];
export const camOf = (c, k = 1, dy = 0) => ({ yaw: -c.yaw, pitch: -c.pitch, s: c.s * k, c: [PIV[0], PIV[1] + dy / c.s, PIV[2]] });
const cams = () => JSON.parse(readFileSync(join(DIR, 'hairs/braid-cams.json'), 'utf8'));
const TEAL = [0.2, 0.95, 0.85];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowbraid')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), tag = opt('tag', ''), C = cams();
  const cw = 260, ch = 400, gap = 8, x0 = 10;

  if (only.includes('cams')) {
    // her head and neck (no hair) under each camera: row 1 the sheet; row 2 her body over the sheet, half see-through;
    // row 3 the sheet's silhouettes (white the hair, grey the skin) with her head and neck over them in teal
    const rig = buildRig('female'), bare = { shave: [] };
    const cells = [], imgs = [], y1 = 34, y2 = y1 + ch + 22, y3 = y2 + ch + 22;
    LABELS.forEach(([v, label], i) => {
      const c = C[v], x = x0 + i * (cw + gap), crop = [c.cx - cw / 2, 205 - ch / 2, cw, ch], dy = (c.cy - 205);
      imgs.push({ src: REF, size: REF_SIZE, crop, box: [x, y1, cw, ch] });
      imgs.push({ src: REF, size: REF_SIZE, crop, box: [x, y2, cw, ch] });
      imgs.push({ src: MASK, size: [1536, 405], crop, box: [x, y3, cw, ch] });
      const body = bodyMesh(rig, bare, rig.B.verts.map(warpOf(c)), SHEET_HAIR, { parts: ['head', 'neck', 'torso'] });
      cells.push({ meshes: [{ ...body, alpha: 0.55 }], cam: camOf(c, 1, dy), box: [x, y2, cw, ch], see: true, label });
      cells.push({ meshes: [{ ...body, col: body.col.map(() => TEAL), flat: true, alpha: 0.5 }], cam: camOf(c, 1, dy), box: [x, y3, cw, ch], see: true, label: `yaw ${c.yaw}°, pitch ${c.pitch}°, ${c.s} px/unit` });
    });
    await shoot(x0 * 2 + 5 * cw + 4 * gap, y3 + ch + 10, cells, join(out, `braid-cams${tag}.png`), {
      imgs, texts: [{ css: 'left:12px;top:6px', html: 'Side braid sheet: the cameras registered to her head and neck (row 2 her body over the sheet; row 3 over the sheet\'s hair, white, and skin, grey)' }] });
  }
  // the hair to draw: the carved hull's outer faces (--only hull) or the built hair
  const RIGS = {}, HAIRS = {};
  const who = opt('who', 'female').split(',');
  const H = only.includes('cams') && only.length === 1 ? null : carve();
  for (const w of who) {
    RIGS[w] = w === 'female' && H ? H.rig : buildRig(w);
    if (only.includes('hull')) HAIRS[w] = hullMesh(carve({ rig: RIGS[w], vox: 0.05 }));
    else if (H) HAIRS[w] = buildBraid(RIGS[w], undefined, H);
  }
  const tri3 = (h) => h.tris.filter(([, , , pi]) => !h.polys[pi].buzz).map(([a, b, c]) => [h.verts[a], h.verts[b], h.verts[c]]);

  if (only.includes('views') || only.includes('hull')) for (const w of who) {
    // row 1 the sheet; row 2 ours; row 3 ours over the sheet, a see-through teal (the head left out), with each view's
    // outline difference
    const rig = RIGS[w], hair = HAIRS[w], diff = outlineDiff(tri3(hair), bodyTris(rig.B));
    const cells = [], imgs = [], y1 = 34, y2 = y1 + ch + 22, y3 = y2 + ch + 22;
    LABELS.forEach(([v, label], i) => {
      const c = C[v], x = x0 + i * (cw + gap), crop = [c.cx - cw / 2, 205 - ch / 2, cw, ch], dy = c.cy - 205;
      imgs.push({ src: REF, size: REF_SIZE, crop, box: [x, y1, cw, ch] });
      imgs.push({ src: REF, size: REF_SIZE, crop, box: [x, y3, cw, ch] });
      const w = warpOf(c), Pw = rig.B.verts.map(w), Hw = hair.verts.map(w);
      cells.push({ meshes: [bodyMesh(rig, hair, Pw), hairMesh(rig, hair, Hw)], cam: camOf(c, 1, dy), box: [x, y2, cw, ch], label });
      cells.push({ meshes: [{ ...bodyMesh(rig, hair, Pw), depthOnly: true }, { ...hairMesh(rig, hair, Hw), tris: hair.tris.filter(([, , , pi]) => !hair.polys[pi].buzz), col: hair.polys.map(() => TEAL), flat: true, alpha: 0.42 }],
        cam: camOf(c, 1, dy), box: [x, y3, cw, ch], see: true, label: `ours over the sheet: outline off ${diff[v].px} px` });
    });
    const mean = (Object.values(diff).reduce((a, d) => a + d.px, 0) / 5).toFixed(2);
    const what = only.includes('hull') ? 'the hull carved from the sheet\'s five silhouettes' : `${hair.tris.length} hair triangles, ${hair.pieces.length} pieces`;
    await shoot(x0 * 2 + 5 * cw + 4 * gap, y3 + ch + 10, cells, join(out, `braid-${only.includes('hull') ? 'hull' : 'sheet'}-${w}${tag}.png`), {
      imgs, texts: [{ css: 'left:12px;top:6px', html: `Side braid — the sheet (top), the ${w === 'male' ? 'man' : 'woman'} (middle), ours over the sheet (bottom): ${what}; outline off ${mean} px on average` }] });
    console.log(w, 'outline difference', JSON.stringify(diff));
  }
  if (only.includes('pieces')) for (const w of who) {
    // each piece in its own colour over the sheet (the crown's clumps her right warm, her left cool; the braid's hearts
    // greens; the tie, the tip and the strands their own), see-through, the body hiding what is behind it
    const rig = RIGS[w], hair = HAIRS[w], cells = [], imgs = [], K = 1.35, cw2 = 360, ch2 = 470;
    const PAL = { R: [[1, 0.45, 0.35], [1, 0.75, 0.3], [1, 0.4, 0.75], [0.95, 0.95, 0.35], [1, 0.6, 0.5], [0.85, 0.5, 1]], L: [[0.3, 0.7, 1], [0.35, 1, 0.75], [0.6, 0.55, 1], [0.3, 1, 1], [0.5, 0.85, 0.5], [0.4, 0.5, 0.95]], heart: [[0.4, 1, 0.4], [0.2, 0.75, 0.3], [0.6, 1, 0.5], [0.3, 0.9, 0.6]] };
    const colOf = (id) => { if (/^crownL/.test(id)) return +id.slice(6) % 2 ? [1, 1, 1] : [0.75, 0.75, 0.8]; if (/^crownR/.test(id)) return +id.slice(6) % 2 ? [0.15, 0.15, 0.2] : [0.4, 0.4, 0.45]; const m = id.match(/^(R|L|heart)(\d+)$/); return m ? PAL[m[1]][(+m[2] - 1) % PAL[m[1]].length] : id === 'tie' ? [1, 1, 1] : id === 'tip' ? [0.2, 0.5, 0.25] : [1, 0.85, 0.6]; };
    const col = hair.polys.map((p) => colOf(hair.pieces[p.piece].id));
    LABELS.forEach(([v, label], i) => {
      const c = C[v], x = 10 + i * (cw2 + gap), cy = c.cy + 45, crop = [c.cx - cw2 / K / 2, cy - ch2 / K / 2, cw2 / K, ch2 / K], wv = warpOf(c);
      imgs.push({ src: REF, size: REF_SIZE, crop, box: [x, 34, cw2, ch2] });
      cells.push({ meshes: [{ ...bodyMesh(rig, hair, rig.B.verts.map(wv)), depthOnly: true }, { ...hairMesh(rig, hair, hair.verts.map(wv)), col, flat: true, alpha: 0.55 }], cam: camOf(c, K, c.cy - cy), box: [x, 34, cw2, ch2], see: true, label });
    });
    await shoot(10 + 5 * (cw2 + gap), ch2 + 44, cells, join(out, `braid-pieces-${w}${tag}.png`), { imgs,
      texts: [{ css: 'left:12px;top:6px', html: `Per piece over the sheet: her right's clumps R1-R6 warm, her left's L1-L6 cool, the hearts green, the tie white (${hair.pieces.map((p) => p.id).join(', ')})` }] });
  }

  if (only.includes('rear')) for (const w of who) {
    // the back of the head larger: the profile, the rear three-quarter and the back, each the sheet (top), ours (middle)
    // and ours per piece over the sheet (bottom)
    const rig = RIGS[w], hair = HAIRS[w], K = 1.3, cw2 = 380, ch2 = 420, cells = [], imgs = [];
    const PAL = { R: [[1, 0.45, 0.35], [1, 0.75, 0.3], [1, 0.4, 0.75], [0.95, 0.95, 0.35], [1, 0.6, 0.5], [0.85, 0.5, 1]], L: [[0.3, 0.7, 1], [0.35, 1, 0.75], [0.6, 0.55, 1], [0.3, 1, 1], [0.5, 0.85, 0.5], [0.4, 0.5, 0.95]], heart: [[0.1, 0.55, 0.15], [0.55, 1, 0.35], [0.4, 1, 0.4], [0.2, 0.75, 0.3], [0.6, 1, 0.5], [0.3, 0.9, 0.6]] };
    const colOf = (id) => { const m = id.match(/^(R|L|heart)(\d+)$/); return m ? PAL[m[1]][(+m[2] - 1) % PAL[m[1]].length] : id === 'tie' ? [1, 1, 1] : id === 'tip' ? [0.2, 0.5, 0.25] : [1, 0.85, 0.6]; };
    const col = hair.polys.map((p) => colOf(hair.pieces[p.piece].id));
    LABELS.filter(([v]) => ['profile', 'r3', 'back'].includes(v)).forEach(([v, label], i) => {
      const c = C[v], x = 10 + i * (cw2 + gap), cy = c.cy + 40, crop = [c.cx - cw2 / K / 2, cy - ch2 / K / 2, cw2 / K, ch2 / K], wv = warpOf(c);
      const ys = [34, 34 + ch2 + gap, 34 + 2 * (ch2 + gap)];
      imgs.push({ src: REF, size: REF_SIZE, crop, box: [x, ys[0], cw2, ch2] }, { src: REF, size: REF_SIZE, crop, box: [x, ys[2], cw2, ch2] });
      cells.push({ meshes: [bodyMesh(rig, hair, rig.B.verts.map(wv)), hairMesh(rig, hair, hair.verts.map(wv))], cam: camOf(c, K, c.cy - cy), box: [x, ys[1], cw2, ch2], label });
      cells.push({ meshes: [{ ...bodyMesh(rig, hair, rig.B.verts.map(wv)), depthOnly: true }, { ...hairMesh(rig, hair, hair.verts.map(wv)), col, flat: true, alpha: 0.6 }], cam: camOf(c, K, c.cy - cy), box: [x, ys[2], cw2, ch2], see: true, label: 'per piece over the sheet' });
    });
    await shoot(10 + 3 * (cw2 + gap), 34 + 3 * (ch2 + gap), cells, join(out, `braid-rear-${w}${tag}.png`), { imgs,
      texts: [{ css: 'left:12px;top:6px', html: `Back of the head: sheet, ${w === 'male' ? 'man' : 'woman'}, per piece (links dark to light green from the start)` }] });
  }

  if (only.includes('joints')) for (const w of who) {
    // the braid's joints close: link 1 into link 2 (the back), link 2 into the hanging braid (the rear three-quarter), the
    // braid on the shoulder (the profile and the front three-quarter); ours (top), per piece (bottom)
    const rig = RIGS[w], hair = HAIRS[w], K = 2.4, cw2 = 320, ch2 = 340, cells = [];
    const PAL = [[0.1, 0.55, 0.15], [0.55, 1, 0.35], [0.95, 0.75, 0.3], [0.3, 0.75, 1], [0.95, 0.45, 0.8], [0.6, 1, 0.9]];
    const col = hair.polys.map((p) => { const id = hair.pieces[p.piece].id, m = id.match(/^heart(\d+)$/); return m ? PAL[(+m[1] - 1) % PAL.length] : id === 'tie' ? [1, 1, 1] : id === 'tip' ? [0.2, 0.5, 0.25] : [0.55, 0.45, 0.42]; });
    const mid = (...ids) => { const vs = hair.pieces.filter((p) => ids.includes(p.id)).flatMap((p) => hair.verts.slice(...p.verts)); return vs.reduce((a, q) => a.map((x, k) => x + q[k] / vs.length), [0, 0, 0]); };
    // (the joints under the sheet's back and rear three-quarter cameras; the shoulder from her right and from the front
    // right, level)
    const shots = [['back', 'Link 1 into link 2', mid('heart1', 'heart2'), 1], ['r3', 'Link 2 into the hanging braid', mid('heart2', 'heart3'), 1], [{ yaw: 90, pitch: 0 }, 'On the shoulder, her right', mid('heart4', 'heart5'), 0.6], [{ yaw: 40, pitch: 0 }, 'On the shoulder, front right', mid('heart4', 'heart5'), 0.6]];
    shots.forEach(([v, label, q, kk], i) => {
      const c = typeof v === 'string' ? C[v] : { ...v, s: C.front.s }, wv = typeof v === 'string' ? warpOf(c) : (p) => p, x = 10 + i * (cw2 + gap), cam = { yaw: -c.yaw, pitch: -c.pitch, s: c.s * K * kk, c: wv(q) };
      cells.push({ meshes: [bodyMesh(rig, hair, rig.B.verts.map(wv)), hairMesh(rig, hair, hair.verts.map(wv))], cam, box: [x, 34, cw2, ch2], label });
      cells.push({ meshes: [bodyMesh(rig, hair, rig.B.verts.map(wv)), { ...hairMesh(rig, hair, hair.verts.map(wv)), col, flat: true }], cam, box: [x, 34 + ch2 + gap, cw2, ch2], label: 'per piece' });
    });
    await shoot(10 + 4 * (cw2 + gap), 34 + 2 * (ch2 + gap), cells, join(out, `braid-joints-${w}${tag}.png`), { imgs: [],
      texts: [{ css: 'left:12px;top:6px', html: `The braid's joints, the ${w === 'male' ? 'man' : 'woman'}: links 1 and 2 dark and light green, then the hanging hearts` }] });
  }

  if (only.includes('wire')) for (const w of who) {
    // the topology: front, profile and back, every polygon's edges
    const rig = RIGS[w], hair = HAIRS[w], cw2 = 330, ch2 = 520;
    const cells = [[0, 'Front'], [-90, 'Profile (her right)'], [180, 'Back']].map(([yaw, label], i) => ({ meshes: [{ ...bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts: ['head', 'neck', 'torso'] }), edges: true, edgec: [0.95, 0.85, 0.78] }, { ...hairMesh(rig, hair), edges: true, edgec: [1, 0.93, 0.85] }], cam: { yaw, pitch: 0, s: 105, c: [0, 0.55, 0.1] }, box: [10 + i * (cw2 + 8), 34, cw2, ch2], label }));
    await shoot(3 * cw2 + 36, ch2 + 44, cells, join(out, `braid-wire-${w}${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Topology: ${hair.tris.length} hair triangles in ${hair.pieces.length} closed pieces (${hair.pieces.map((p) => p.id).join(', ')})` }], imgs: [] });
  }

  if (only.includes('exploded')) for (const w of who) {
    // each piece moved out from the skull's centre (the braid's down and out from its spine) along its own middle's
    // direction
    const rig = RIGS[w], hair = HAIRS[w], Cn = hair.centre, H2 = hair.verts.map((p) => [...p]);
    hair.pieces.forEach((pc, n) => {
      const vs = hair.verts.slice(...pc.verts), mid = vs.reduce((a, p) => a.map((x, k) => x + p[k] / vs.length), [0, 0, 0]);
      let d = mid.map((x, k) => x - Cn[k]);
      const l = Math.hypot(...d), first = hair.pieces.findIndex((q) => q.kind === 'braid');
      // (the braid's pieces out to her right, each further down than the one above)
      const off = pc.kind === 'braid' || pc.kind === 'tie' ? [-0.75, -0.22 * (n - first), 0.25] : d.map((x) => (x / l) * (pc.kind === 'clump' ? 0.45 : 0.35));
      for (let i = pc.verts[0]; i < pc.verts[1]; i++) H2[i] = H2[i].map((x, k) => x + off[k]);
    });
    const cells = [{ meshes: [bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts: ['head', 'neck', 'torso'] }), hairMesh(rig, hair, H2)], cam: { yaw: -30, pitch: 6, s: 72, c: [-0.4, 0.4, 0.1] }, box: [560, 34, 460, 520], label: 'Ours: the pieces pulled apart' }];
    await shoot(1030, 564, cells, join(out, `braid-exploded-${w}${tag}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Clump breakdown: the sheet, ours (${hair.pieces.map((p) => p.id).join(', ')})` }], imgs: [{ src: REF, size: REF_SIZE, crop: [470, 480, 520, 540], box: [10, 34, 540, 520] }] });
  }

  if (only.includes('close')) for (const w of who) {
    // the views larger, the sheet's (left) beside ours (right); `--focus braid` on the braid
    const rig = RIGS[w], hair = HAIRS[w], K = 1.7, cw2 = 400, ch2 = 460, cells = [], imgs = [], braid = opt('focus', '') === 'braid';
    LABELS.filter(([v]) => v !== 'r3').forEach(([v, label], i) => {
      const c = C[v], x = 10 + (i % 2) * 2 * (cw2 + gap), y = 34 + Math.floor(i / 2) * (ch2 + gap), cy = braid ? c.cy + 150 : c.cy - 10;
      imgs.push({ src: REF, size: REF_SIZE, crop: [c.cx - cw2 / K / 2, cy - ch2 / K / 2, cw2 / K, ch2 / K], box: [x, y, cw2, ch2] });
      const w = warpOf(c);
      cells.push({ meshes: [bodyMesh(rig, hair, rig.B.verts.map(w)), hairMesh(rig, hair, hair.verts.map(w))], cam: camOf(c, K, c.cy - cy), box: [x + cw2 + gap, y, cw2, ch2], label });
    });
    await shoot(10 + 4 * (cw2 + gap) + 2, 34 + 2 * (ch2 + gap) + 10, cells, join(out, `braid-close-${w}${braid ? '-braid' : ''}${tag}.png`), { imgs,
      texts: [{ css: 'left:12px;top:6px', html: `Close: the sheet (left), the ${w === 'male' ? 'man' : 'woman'} (right)` }] });
  }
  await closeBrowser();
}
