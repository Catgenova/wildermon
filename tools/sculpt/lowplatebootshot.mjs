// The plate boots (tools/sculpt/garments/plateboots.mjs) on the low-poly bodies, looked over against their sheet
// (tools/sculpt/ref/plate-boots.png) and in the rig's poses:
//
//   node tools/sculpt/lowplatebootshot.mjs --out <dir> [--tag <name>] [--only sheet,wire,detail,feet,full,walk,metrics]
//       [--design '{...}'] [--under <leggings module>]
//     plate-boots-<tag>-sheet.png: the sheet's five views (0, 45, 90, 135, 180) of both bodies' boots, each row of the
//       sheet's own views above the model's (his row first, as the sheet), the legs below the knee;
//     plate-boots-<tag>-wire.png: the same with the polygons' outlines and the triangle counts by part;
//     plate-boots-<tag>-detail.png: the sheet's key details (greave top, plate layer, toe cap, heel) beside the model's;
//     plate-boots-<tag>-feet.png: the feet and shins in the game's walk (eight keys) and idle, both bodies, side and front;
//     plate-boots-<tag>-full.png: both bodies whole, standing, walking and idle, at the game's heights (she 0.85 of him);
//     plate-boots-<tag>-walk.gif: the game's walk, both bodies, side and three-quarter;
//     plate-boots-metrics.json: the checks at rest and in every pose (crossings with the body's polygons left showing,
//       and with all of them; the boots' own).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { buildRig, posed, skin, fromGame, gameRig, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, checks, crossPairs } from './lowgarment.mjs';
import { buildPlateBoots, plateBootWeights, MATS, GLOW, DESIGN } from './garments/plateboots.mjs';
import { shoot, closeBrowser } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowplateboots'));
const tag = opt('tag', 'x');
const only = opt('only', 'sheet,metrics').split(',');
const over = JSON.parse(opt('design', '{}'));
mkdirSync(out, { recursive: true });
const DIR = new URL('.', import.meta.url).pathname;
const SHEET = join(DIR, 'ref/plate-boots.png');

const SKIN = [0.68, 0.49, 0.41];
// (a material drawn emissive: its colour plus 2, which lowgarmentshot.mjs draws unlit)
const colOf = (mat) => (GLOW.includes(mat) ? MATS[mat].map((x) => x + 2) : MATS[mat]);
const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who), G = buildPlateBoots(rig, { ...DESIGN[who], ...(over[who] ?? over) });
  G.vw = plateBootWeights(rig, G);
  const hidden = new Set(G.hides);
  M[who] = { rig, G, hidden, shown: rig.B.tris.filter((t) => !hidden.has(t.poly)) };
}
const bodyCol = (rig) => rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13]));
const bodyMesh = (who, P, cut = Infinity) => {
  const { rig, hidden } = M[who];
  const keep = rig.B.polys.map((p, pi) => !hidden.has(pi) && p.v.every((i) => P[i][1] < cut));
  return { who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.filter((t) => keep[t.poly]).map((t) => [...t.v, t.poly]), col: bodyCol(rig) };
};
const bootMesh = (who, P) => { const { G } = M[who]; return { who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => colOf(p.mat)) }; };

/* ---- poses ---------------------------------------------------------------------------------------------------------- */
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
function testPoses(rig) {
  const W = (bone, axis, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
  const symW = (p, bone, axis, deg) => { p[`${bone}_l`] = mm(W(`${bone}_l`, axis, deg), p[`${bone}_l`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); p[`${bone}_r`] = mm(W(`${bone}_r`, [-axis[0], axis[1], axis[2]], -deg), p[`${bone}_r`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); return p; };
  const P = [
    { id: 'tpose', label: 'Arms out', pose: symW(symW({}, 'upperarm', Z, 74), 'lowerarm', Z, 10) },
    { id: 'forward', label: 'Arms forward', pose: symW(symW(symW({}, 'clavicle', Y, -14), 'upperarm', X, -84), 'upperarm', Y, -2) },
  ];
  if (rig.who === 'female') for (const e of P) e.pose = armsOut(rig, e.pose);
  return P;
}
const games = {};
async function game(who) {
  if (games[who]) return games[who];
  const rig = M[who].rig, g = await gameRig(rig, join(out, 'game'));
  const at = (moving, u) => fromGame(rig, g.bonesOf(g.sculptRig({ phase: u * Math.PI * 2, moving, facing: 0, swimming: false, working: false, look: g.look }).rig, g.PROPS, [], g.REST_EXTRAS), g.gRest);
  return (games[who] = { at });
}
/** Body and boots in a pose, stood on the boots' soles (their lowest at the rest's ground). */
function dress(who, pose) {
  const { rig, G } = M[who];
  const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G);
  const dy = G.ground - Math.min(...G.soles.map((i) => PG[i][1]));
  const sh = (P) => P.map((p) => [p[0], p[1] + dy, p[2]]);
  return { PB: sh(PB), PG: sh(PG), dy };
}
function crossings(who, d) {
  const { rig, G, shown } = M[who];
  return { shown: crossPairs(d.PG, G.tris, d.PB, shown).length, all: crossPairs(d.PG, G.tris, d.PB, rig.B.tris).length };
}

/* ---- the sheet: five views of both bodies' boots, the sheet's own above each ---------------------------------------- */
// the sheet's views (plate-boots.png, 1536 x 1024): his row at y 95, hers at 425
const CROPS = {
  male: [[30, 92, 190, 245], [212, 92, 160, 245], [355, 92, 140, 245], [490, 92, 190, 245], [648, 92, 190, 245]],
  female: [[32, 422, 190, 235], [222, 422, 155, 235], [362, 422, 125, 235], [490, 422, 175, 235], [648, 422, 190, 235]],
};
const VIEWS = [[0, 'Front (0°)'], [-45, 'Three-quarter (45°)'], [-90, 'Side (90°)'], [-135, 'Rear three-quarter (135°)'], [180, 'Back (180°)']];
async function sheet(file, wire) {
  const cw = 250, ch = 300, top = 34, cells = [], imgs = [], texts = [];
  ['male', 'female'].forEach((who, r) => {
    const { rig, G } = M[who], d = dress(who, {});
    const pull = who === 'male' ? 0.45 : 0.6;
    const inn = (P, sideOf) => P.map((p, i) => [p[0] - Math.sign(sideOf(i, p)) * pull, p[1], p[2]]);
    const PB = inn(d.PB, (i) => rig.B.verts[i][0]), PG = inn(d.PG, (i) => (G.side[i] === 'L' ? 1 : -1));
    const cut = rig.J.knee[1] + 0.5, ht = rig.J.knee[1] - G.ground;
    const s = 236 / (ht + 0.7), c = [0, G.ground + ht * 0.5 + 0.1, 0.1];
    VIEWS.forEach(([yaw, lab], i) => {
      imgs.push({ src: SHEET, size: [1536, 1024], crop: CROPS[who][i], box: [i * cw, top + r * 2 * ch, cw, ch] });
      const body = bodyMesh(who, PB, cut), boot = bootMesh(who, PG);
      if (wire) { body.edges = false; boot.edges = true; boot.edgec = [0.25, 0.18, 0.1]; }
      cells.push({ meshes: [body, boot], cam: { yaw, pitch: -10, s, c }, box: [i * cw, top + (r * 2 + 1) * ch, cw, ch], label: `${who} ${lab}` });
    });
    const parts = {};
    for (const t of G.tris) { const p = G.polys[t.poly]; if (G.side[p.v[0]] === 'L') parts[p.tag] = (parts[p.tag] ?? 0) + 1; }
    texts.push({ cls: 'lab', css: `left:${5 * cw + 10}px;top:${top + r * 2 * ch + (wire && r === 0 ? 250 : 10)}px;width:260px;white-space:normal`, html: `<b>${who}</b><br>${G.tris.length} triangles (${G.tris.length / 2} a boot)<br>above: the sheet; below: the model` + (wire ? '<br><br>a boot, by part:<br>' + Object.entries(parts).map(([k, v]) => `${k} ${v}`).join('<br>') : '') });
  });
  if (wire) imgs.push({ src: SHEET, size: [1536, 1024], crop: [585, 700, 230, 300], box: [5 * cw, top, 280, 240] });
  texts.push({ css: 'left:10px;top:6px', html: `Plate boots, ${tag}: the sheet (tools/sculpt/ref/plate-boots.png) above each body's row, the model below` });
  await shoot(5 * cw + 280, top + 4 * ch, cells, file, { texts, imgs });
}
if (only.includes('sheet')) await sheet(join(out, `plate-boots-${tag}-sheet.png`), false);
if (only.includes('wire')) await sheet(join(out, `plate-boots-${tag}-wire.png`), true);

/* ---- the key details close up ---------------------------------------------------------------------------------------- */
if (only.includes('detail')) {
  const cw = 250, ch = 240, top = 34, cells = [], imgs = [];
  // the sheet's key details: his greave top, plate layer, toe cap, heel
  const D = [[[877, 97, 148, 108], 'greave top'], [[1043, 97, 148, 108], 'plate layer'], [[877, 233, 148, 108], 'toe cap'], [[1043, 233, 148, 108], 'heel / back']];
  ['male', 'female'].forEach((who, r) => {
    const { rig, G } = M[who], d = dress(who, {});
    const L = (i) => G.side[i] === 'L';
    const R = G.rings.L, at = (ring, k) => d.PG[R[ring][k]];
    const crest = at('c3', 0), toe = at('r3', 0), heel = at('r3', 5), mid = at('g1', 0);
    const P = d.PG, PB = d.PB;
    const body = bodyMesh(who, PB, rig.J.knee[1] + 0.5);
    const boot = bootMesh(who, P); boot.tris = boot.tris.filter((t) => L(t[0]));
    const bodyL = { ...body, tris: body.tris.filter((t) => PB[t[0]][0] > 0) };
    const views = [[0, -8, crest, 120, 'greave top'], [-150, -8, lerpY(at('c1', 5), 0.1), 110, 'plate layer (back)'], [-55, -18, toe, 130, 'toe cap'], [160, -10, heel, 120, 'heel / back']];
    views.forEach(([yaw, pitch, c, s, lab], i) => {
      if (r === 0) imgs.push({ src: SHEET, size: [1536, 1024], crop: D[i][0], box: [i * cw, top, cw, ch] });
      cells.push({ meshes: [bodyL, boot], cam: { yaw, pitch, s, c: [c[0], c[1] - (i === 0 ? 0.25 : 0), c[2]] }, box: [i * cw, top + (r + 1) * ch, cw, ch], label: `${who} ${lab}` });
    });
  });
  function lerpY(p, dy) { return [p[0], p[1] + dy, p[2]]; }
  await shoot(4 * cw, top + 3 * ch, cells, join(out, `plate-boots-${tag}-detail.png`), { texts: [{ css: 'left:10px;top:6px', html: `Plate boots, ${tag}: the sheet's key details (his, top row) and the model's left boot, his and hers` }], imgs });
}

/* ---- metrics -------------------------------------------------------------------------------------------------------- */
if (only.includes('metrics')) {
  const metrics = {};
  for (const who of ['male', 'female']) {
    const { rig, G } = M[who], g = await game(who);
    const c = checks(G, G.verts, rig.B, rig.B.verts);
    const list = [{ id: 'rest', pose: {} }, ...testPoses(rig), ...Array.from({ length: 16 }, (_, k) => ({ id: `walk-${k}`, pose: g.at(true, k / 16) })), ...Array.from({ length: 6 }, (_, k) => ({ id: `idle-${k}`, pose: g.at(false, k * 0.12) }))];
    metrics[who] = { tris: c.tris, open: c.open, nonManifold: c.nonManifold, offPlane: c.offPlane, bones: rig.bones.length, poses: {} };
    for (const e of list) {
      const d = dress(who, e.pose), x = crossings(who, d), cc = checks(G, d.PG, rig.B, d.PB);
      metrics[who].poses[e.id] = { body: x.shown, bodyAll: x.all, self: cc.self, selfParts: cc.selfParts, bodyParts: cc.bodyParts };
    }
    console.log(who, JSON.stringify({ ...metrics[who], poses: undefined }), Object.entries(metrics[who].poses).map(([k, v]) => `${k}:${v.body}/${v.bodyAll}/${v.self}`).join(' '));
  }
  writeFileSync(join(out, 'plate-boots-metrics.json'), JSON.stringify(metrics, null, 1));
}

/* ---- the feet in the walk and idle ------------------------------------------------------------------------------------ */
if (only.includes('feet')) {
  const cw = 200, ch = 300, top = 34, cells = [];
  let row = 0;
  for (const who of ['male', 'female']) {
    const g = await game(who), { G, rig } = M[who];
    const keys = [...Array.from({ length: 8 }, (_, k) => [`walk ${k + 1}/8`, g.at(true, k / 8)]), ['idle', g.at(false, 0.12)]];
    for (const [yaw, view] of [[-90, 'side'], [0, 'front']]) {
      keys.forEach(([lab, pose], k) => {
        const d = dress(who, pose), x = crossings(who, d);
        const L = d.PG.filter((_, i) => yaw === 0 || G.side[i] === 'L'), m = L.reduce((a, p) => [a[0] + p[0] / L.length, 0, a[2] + p[2] / L.length], [0, 0, 0]);
        const hk = rig.J.knee[1] - G.ground;
        cells.push({ meshes: [bodyMesh(who, d.PB, G.ground + hk + 1.6), bootMesh(who, d.PG)], cam: { yaw, pitch: 6, s: yaw ? 270 / (hk + 1.8) : 200 / (hk + 1.8), c: [m[0], G.ground + (hk + 1.2) / 2, m[2]] }, box: [k * cw, top + row * ch, cw, ch], label: `${who} ${view === 'side' ? 'left' : view} ${lab} · ${x.shown}` });
      });
      row++;
    }
  }
  await shoot(9 * cw, top + row * ch, cells, join(out, `plate-boots-${tag}-feet.png`), { texts: [{ css: 'left:10px;top:6px', html: `Plate boots, ${tag}: the game's walk (eight keys) and idle, side and front; the number: the boots' triangles crossing the body's` }] });
}

/* ---- both bodies whole --------------------------------------------------------------------------------------------- */
if (only.includes('full')) {
  const cw = 260, ch = 560, top = 34, cells = [];
  const sc = { male: 1, female: 0.85 };
  let k = 0;
  for (const who of ['male', 'female']) {
    const g = await game(who);
    for (const [lab, pose, yaw] of [['rest', {}, 0], ['rest', {}, -40], ['walk', g.at(true, 0.25), -90], ['walk', g.at(true, 0.6), -40], ['idle', g.at(false, 0.12), -20]]) {
      const d = dress(who, pose), s = sc[who], G0 = M[who].G.ground;
      const S = (P) => P.map((p) => [p[0] * s, (p[1] - G0) * s, p[2] * s]);
      cells.push({ meshes: [bodyMesh(who, S(d.PB)), bootMesh(who, S(d.PG))], cam: { yaw, pitch: 4, s: 36, c: [0, 7.2, 0] }, box: [k * cw, top, cw, ch], label: `${who} ${lab}` });
      k++;
    }
  }
  await shoot(k * cw, top + ch, cells, join(out, `plate-boots-${tag}-full.png`), { texts: [{ css: 'left:10px;top:6px', html: `Plate boots, ${tag}: both bodies whole at the game's heights (she is 0.85 of him)` }] });
}

/* ---- the walk as a GIF ---------------------------------------------------------------------------------------------- */
if (only.includes('walk')) {
  const frames = join(out, 'walk-frames');
  mkdirSync(frames, { recursive: true });
  const cw = 240, ch = 300, F = 16;
  for (let k = 0; k < F; k++) {
    const cells = [];
    let i = 0;
    for (const who of ['male', 'female']) for (const yaw of [-90, -30]) {
      const g = await game(who), d = dress(who, g.at(true, k / F)), { G, rig } = M[who], hk = rig.J.knee[1] - G.ground;
      const L = d.PG.filter((_, j) => yaw !== -90 || G.side[j] === 'L'), m = L.reduce((a, p) => [a[0] + p[0] / L.length, 0, a[2] + p[2] / L.length], [0, 0, 0]);
      cells.push({ meshes: [bodyMesh(who, d.PB, G.ground + hk + 1.6), bootMesh(who, d.PG)], cam: { yaw, pitch: 6, s: 230 / (hk + 2), c: [m[0], G.ground + (hk + 1.2) / 2, m[2]] }, box: [i++ * cw, 0, cw, ch] });
    }
    await shoot(cw * 4, ch, cells, join(frames, `f${String(k).padStart(2, '0')}.png`));
  }
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=90, loop=0)
`, frames, join(out, `plate-boots-${tag}-walk.gif`)]);
  rmSync(frames, { recursive: true, force: true });
  console.log('wrote', join(out, `plate-boots-${tag}-walk.gif`));
}
rmSync(join(out, 'game'), { recursive: true, force: true });
await closeBrowser();
