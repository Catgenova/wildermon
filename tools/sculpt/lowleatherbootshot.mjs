// The leather boots (tools/sculpt/garments/leatherboots.mjs) on the low-poly bodies, looked over against their sheet
// (tools/sculpt/ref/leather-boots.png) and in the rig's poses:
//
//   node tools/sculpt/lowleatherbootshot.mjs --out <dir> [--tag <name>] [--only sheet,wire,detail,side,feet,full,walk,metrics]
//       [--design '{...}'] [--enchanted] [--legs <dir>] [--parts '{"laces":false,...}'] [--clay]  (--parts: the decals left
//       out, for a blockout; --clay: every material one clay colour)   (--enchanted: the sheet, the details and the side view plain and
//       enchanted; --legs: the leather leggings, <dir>/lowleatherlegs-<who>.json as the game loads them, worn under the boots,
//       in every picture, and the boots' crossings with them in the metrics and the walk)
//     leather-boots-<tag>-sheet.png: the sheet's five views (0, 45, 90, 135, 180) of both bodies' boots, each row of the
//       sheet's own views above the model's (his row first, as the sheet), the legs below the knee;
//     leather-boots-<tag>-wire.png: the same with the polygons' outlines and the triangle counts by part;
//     leather-boots-<tag>-detail.png: the sheet's key details (cuff, lacing, toe cap, heel and sole) beside the model's;
//     leather-boots-<tag>-feet.png: the feet and shins in the game's walk (eight keys) and idle, both bodies, side and front;
//     leather-boots-<tag>-full.png: both bodies whole, standing, walking and idle, at the game's heights (she 0.85 of him);
//     leather-boots-<tag>-walk.gif: the game's walk, both bodies, side and three-quarter;
//     leather-boots-metrics.json: the checks at rest and in every pose (crossings with the body's polygons left showing,
//       and with all of them; the boots' own).
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { buildRig, posed, skin, fromGame, gameRig, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, checks, crossPairs } from './lowgarment.mjs';
import { buildLeatherBoots, leatherBootWeights, underOf, MATS, LOOKS, DESIGN, ANG } from './garments/leatherboots.mjs';
import { shoot, closeBrowser, LOOKS as SHOWN, lookColour } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowleatherboots'));
const tag = opt('tag', 'x');
const only = opt('only', 'sheet,metrics').split(',');
const over = JSON.parse(opt('design', '{}'));
const LEGS = opt('legs', null);
const PARTS = JSON.parse(opt('parts', '{}')), CLAY = args.includes('--clay');
mkdirSync(out, { recursive: true });
const DIR = new URL('.', import.meta.url).pathname;
const SHEET = join(DIR, 'ref/leather-boots.png');

const SKIN = [0.68, 0.49, 0.41];
// (a material in a look: plain, or enchanted (its unlit colours plus 2, which lowgarmentshot.mjs draws unlit); with
// --enchanted the sheet, the details and the side view show both)
const colOf = (mat, look = 'plain') => (CLAY ? [0.5, 0.52, 0.56] : LOOKS[look]?.[mat] ? lookColour(LOOKS[look][mat]) : MATS[mat]);
const M = {};
for (const who of ['male', 'female']) {
  // (--legs <dir>: the leather leggings as the game would load them, lowleatherlegs-<who>.json, under the boots, which are
  // built over them)
  const LA = LEGS ? JSON.parse(readFileSync(join(LEGS, `lowleatherlegs-${who}.json`), 'utf8')) : null, LG = LA ? legsOf(LA) : null;
  const rig = buildRig(who), G = buildLeatherBoots(rig, { ...DESIGN[who], ...(over[who] ?? over) }, { under: LA ? [underOf(LA)] : [], parts: PARTS });
  G.vw = leatherBootWeights(rig, G);
  const hidden = new Set([...G.hides, ...(LG?.hides ?? [])]);
  M[who] = { rig, G, LG, hidden, shown: rig.B.tris.filter((t) => !hidden.has(t.poly)) };
}
/** A garment asset (lowgarment.mjs garmentAsset) as a mesh to skin: its vertices, weights, polygons and their colours plain and enchanted. */
function legsOf(A) {
  const verts = [], vw = A.weights.map((w) => { const o = []; for (let j = 0; j < w.length; j += 2) o.push([w[j], w[j + 1]]); return o; });
  for (let i = 0; i < A.verts.length; i += 3) verts.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
  const tris = []; for (let t = 0; t < A.tris.length; t += 4) tris.push({ v: [A.tris[t], A.tris[t + 1], A.tris[t + 2]], poly: A.tris[t + 3] });
  const col = (look) => A.polys.map(([, m]) => lookColour((A[look] ?? A.plain)[m]));
  return { verts, vw, tris, polys: A.polys.map(([v]) => v), col: { plain: col('plain'), enchanted: col('enchanted') }, hides: A.hides ?? [], bones: [] };
}
const legsMesh = (who, P, look = 'plain') => { const { LG } = M[who]; return { who, P, polys: LG.polys, tris: LG.tris.map((t) => [...t.v, t.poly]), col: LG.col[look] }; };
/** The meshes of a cell: the body, the leggings if worn, the boots. */
const dressed = (who, d, body, boot, look = 'plain', keep = null) => [body, ...(M[who].LG && d.PL ? [keep ? keep(legsMesh(who, d.PL, look)) : legsMesh(who, d.PL, look)] : []), boot];
const bodyCol = (rig) => rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13]));
const bodyMesh = (who, P, cut = Infinity) => {
  const { rig, hidden } = M[who];
  const keep = rig.B.polys.map((p, pi) => !hidden.has(pi) && p.v.every((i) => P[i][1] < cut));
  return { who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.filter((t) => keep[t.poly]).map((t) => [...t.v, t.poly]), col: bodyCol(rig) };
};
const bootMesh = (who, P, look = 'plain') => { const { G } = M[who]; return { who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => colOf(p.mat, look)) }; };
const NL = SHOWN.length;

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
  const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G), PL = M[who].LG ? skinGarment(rig, f, M[who].LG) : null;
  const dy = G.ground - Math.min(...G.soles.map((i) => PG[i][1]));
  const sh = (P) => P.map((p) => [p[0], p[1] + dy, p[2]]);
  return { PB: sh(PB), PG: sh(PG), PL: PL ? sh(PL) : null, dy };
}
function crossings(who, d) {
  const { rig, G, shown, LG } = M[who];
  return { shown: crossPairs(d.PG, G.tris, d.PB, shown).length, all: crossPairs(d.PG, G.tris, d.PB, rig.B.tris).length, legs: LG ? crossPairs(d.PG, G.tris, d.PL, LG.tris).length : 0 };
}

/* ---- the sheet: five views of both bodies' boots, the sheet's own above each ---------------------------------------- */
// the sheet's views (leather-boots.png, 1536 x 1024): his row at y 105, hers at 405
const CROPS = {
  male: [[35, 105, 165, 200], [215, 105, 150, 200], [370, 105, 125, 200], [500, 105, 185, 200], [690, 105, 160, 200]],
  female: [[40, 405, 160, 200], [225, 405, 150, 200], [380, 405, 115, 200], [505, 405, 180, 200], [695, 405, 160, 200]],
};
// (turned as the sheet turns them: the toes toward the left)
const VIEWS = [[0, 'Front (0°)'], [45, 'Three-quarter (45°)'], [90, 'Side (90°)'], [135, 'Rear three-quarter (135°)'], [180, 'Back (180°)']];
async function sheet(file, wire) {
  const cw = 250, ch = 300, top = 34, cells = [], imgs = [], texts = [];
  ['male', 'female'].forEach((who, r) => {
    const { rig, G } = M[who], d = dress(who, {});
    const pull = who === 'male' ? 0.3 : 0.45;
    const inn = (P, sideOf) => P.map((p, i) => [p[0] - Math.sign(sideOf(i, p)) * pull, p[1], p[2]]);
    const PB = inn(d.PB, (i) => rig.B.verts[i][0]), PG = inn(d.PG, (i) => (G.side[i] === 'L' ? 1 : -1)), PL = d.PL ? inn(d.PL, (i, p) => p[0]) : null;
    const cut = rig.J.knee[1] + 0.5, ht = G.tall;
    const s = 205 / (ht + 0.4), c = [0, G.ground + ht * 0.5, 0.2];
    VIEWS.forEach(([yaw, lab], i) => {
      imgs.push({ src: SHEET, size: [1536, 1024], crop: CROPS[who][i], box: [i * cw, top + r * (1 + NL) * ch, cw, ch] });
      SHOWN.forEach((look, j) => {
        const body = bodyMesh(who, PB, cut), boot = bootMesh(who, PG, look);
        if (wire) { body.edges = false; boot.edges = true; boot.edgec = [0.25, 0.18, 0.1]; }
        const legs = PL ? legsMesh(who, PL, look) : null; if (legs) legs.tris = legs.tris.filter((t) => PL[t[0]][1] < cut);
        if (legs && wire) legs.edges = false;
        cells.push({ meshes: [body, ...(legs ? [legs] : []), boot], cam: { yaw, pitch: -10, s, c }, box: [i * cw, top + (r * (1 + NL) + 1 + j) * ch, cw, ch], label: `${who} ${lab}${NL > 1 ? ` · ${look}` : ''}` });
      });
    });
    const parts = {};
    for (const t of G.tris) { const p = G.polys[t.poly]; if (G.side[p.v[0]] === 'L') parts[p.tag] = (parts[p.tag] ?? 0) + 1; }
    texts.push({ cls: 'lab', css: `left:${5 * cw + 10}px;top:${top + (r * (1 + NL) + (wire ? 1 : 0)) * ch - (wire ? 30 : -10)}px;width:260px;white-space:normal;font-size:12px;line-height:14px`, html: `<b>${who}</b><br>${G.tris.length} triangles (${G.tris.length / 2} a boot)<br>above: the sheet; below: the model` + (wire ? '<br><br>a boot, by part:<br>' + Object.entries(parts).map(([k, v]) => `${k} ${v}`).join('<br>') : '') });
  });
  if (wire) imgs.push({ src: SHEET, size: [1536, 1024], crop: [520, 690, 440, 300], box: [5 * cw, top, 280, 240] });
  texts.push({ css: 'left:10px;top:6px', html: `Leather boots, ${tag}: the sheet (tools/sculpt/ref/leather-boots.png) above each body's row, the model below` });
  await shoot(5 * cw + 280, top + 2 * (1 + NL) * ch, cells, file, { texts, imgs });
}
if (only.includes('sheet')) await sheet(join(out, `leather-boots-${tag}-sheet.png`), false);
if (only.includes('wire')) await sheet(join(out, `leather-boots-${tag}-wire.png`), true);

/* ---- the key details close up ---------------------------------------------------------------------------------------- */
if (only.includes('detail')) {
  const cw = 250, ch = 240, top = 34, cells = [], imgs = [];
  // the sheet's key details: his greave top, plate layer, toe cap, heel
  const D = [[[877, 108, 142, 106], 'cuff'], [[1037, 108, 142, 106], 'lacing'], [[877, 266, 142, 92], 'toe cap'], [[1037, 266, 142, 92], 'heel / sole']];
  ['male', 'female'].forEach((who, r) => {
    const { rig, G } = M[who], d = dress(who, {});
    const L = (i) => G.side[i] === 'L';
    const R = G.rings.L, at = (ring, k) => d.PG[R[ring][k]];
    const crest = lerpY(at('c1', 0), 0.45), lace = lerpY(at('g1', 0), 0.35), toe = lerpY(at('r5', 0), -0.15), heel = lerpY(at('r2', ANG.indexOf(180)), 0.3);
    const P = d.PG, PB = d.PB;
    const body = bodyMesh(who, PB, rig.J.knee[1] + 0.5);
    const boots = SHOWN.map((look) => { const b = bootMesh(who, P, look); b.tris = b.tris.filter((t) => L(t[0])); return b; });
    const bodyL = { ...body, tris: body.tris.filter((t) => PB[t[0]][0] > 0) };
    const views = [[25, -8, crest, 95, 'cuff'], [0, -4, lace, 110, 'lacing'], [-60, -16, toe, 110, 'toe cap'], [140, -6, heel, 105, 'heel / sole']];
    views.forEach(([yaw, pitch, c, s, lab], i) => {
      if (r === 0) imgs.push({ src: SHEET, size: [1536, 1024], crop: D[i][0], box: [i * cw, top, cw, ch] });
      boots.forEach((boot, j) => cells.push({ meshes: dressed(who, d, bodyL, boot, SHOWN[j], (m) => ({ ...m, tris: m.tris.filter((t) => m.P[t[0]][0] > 0 && m.P[t[0]][1] < rig.J.knee[1] + 0.5) })), cam: { yaw, pitch, s, c: [c[0], c[1], c[2]] }, box: [i * cw, top + (1 + r * NL + j) * ch, cw, ch], label: `${who} ${lab}${NL > 1 ? ` · ${SHOWN[j]}` : ''}` }));
    });
  });
  function lerpY(p, dy) { return [p[0], p[1] + dy, p[2]]; }
  await shoot(4 * cw, top + (1 + 2 * NL) * ch, cells, join(out, `leather-boots-${tag}-detail.png`), { texts: [{ css: 'left:10px;top:6px', html: `Leather boots, ${tag}: the sheet's key details (his, top row) and the model's left boot, his and hers` }], imgs });
}

/* ---- the side view large, against the sheet's ------------------------------------------------------------------------ */
if (only.includes('side')) {
  const cw = 380, ch = 560, top = 34, cells = [], imgs = [], texts = [];
  // the sheet's side views (his and hers), the toe to the left; the model's left boot from its outer side, the same way round
  const SIDE = { male: [370, 105, 125, 200], female: [380, 405, 115, 200] };
  ['male', 'female'].forEach((who, r) => {
    const { rig, G } = M[who], d = dress(who, {});
    const keepL = (m) => ({ ...m, tris: m.tris.filter((t) => m.P[t[0]][0] > 0) });
    const ht = rig.J.knee[1] - G.ground, s = 440 / (ht + 0.6);
    imgs.push({ src: SHEET, size: [1536, 1024], crop: SIDE[who], box: [r * (1 + NL) * cw, top, cw, ch] });
    const body = keepL(bodyMesh(who, d.PB, rig.J.knee[1] + 0.4));
    SHOWN.forEach((look, j) => {
      const boot = bootMesh(who, d.PG, look); boot.tris = boot.tris.filter((t) => G.side[t[0]] === 'L');
      cells.push({ meshes: dressed(who, d, body, boot, look, (m) => ({ ...m, tris: m.tris.filter((t) => m.P[t[0]][0] > 0 && m.P[t[0]][1] < rig.J.knee[1] + 0.4) })), cam: { yaw: 90, pitch: -6, s, c: [1.2, G.ground + ht * 0.5 + 0.15, 0.3] }, box: [(r * (1 + NL) + 1 + j) * cw, top, cw, ch], label: `${who} side (outer)${NL > 1 ? ` · ${look}` : ''}` });
    });
    // its lengths: heel to toe, the shaft's width over the band, the sole to the cuff's top
    const R = G.rings.L, P = (ring, k) => G.verts[R[ring][k]];
    const kb = ANG.indexOf(180), len = Math.hypot(P('r1', 0)[0] - P('r1', kb)[0], P('r1', 0)[2] - P('r1', kb)[2]), tall = P('c3', 0)[1] - G.ground;
    const wid = Math.hypot(P('b1', 0)[0] - P('b1', kb)[0], P('b1', 0)[2] - P('b1', kb)[2]);
    texts.push({ cls: 'lab', css: `left:${(r * (1 + NL) + 1) * cw + 8}px;top:${top + 22}px;white-space:normal;width:${cw - 16}px;font-size:13px`, html: `heel to toe ${(len / tall).toFixed(2)} of the height (sheet 0.53), ${(len / wid).toFixed(2)} of the shaft at the band (sheet 1.85); height ${(tall / G.design.H).toFixed(2)} H, foot ${(len / G.design.H).toFixed(2)} H` });
  });
  texts.push({ css: 'left:10px;top:6px', html: `Leather boots, ${tag}: the sheet's side view (his, hers) beside the model's left boot from the outside, the toe to the left` });
  await shoot(2 * (1 + NL) * cw, top + ch, cells, join(out, `leather-boots-${tag}-side.png`), { texts, imgs });
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
      metrics[who].poses[e.id] = { body: x.shown, bodyAll: x.all, legs: x.legs, self: cc.self, selfParts: cc.selfParts, bodyParts: cc.bodyParts };
    }
    console.log(who, JSON.stringify({ ...metrics[who], poses: undefined }), Object.entries(metrics[who].poses).map(([k, v]) => `${k}:${v.body}/${v.bodyAll}/${v.self}${LEGS ? `/legs ${v.legs}` : ''}`).join(' '));
  }
  writeFileSync(join(out, 'leather-boots-metrics.json'), JSON.stringify(metrics, null, 1));
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
        cells.push({ meshes: dressed(who, d, bodyMesh(who, d.PB, G.ground + hk + 1.6), bootMesh(who, d.PG), 'plain', (m) => ({ ...m, tris: m.tris.filter((t) => m.P[t[0]][1] < G.ground + hk + 1.6) })), cam: { yaw, pitch: 6, s: yaw ? 270 / (hk + 1.8) : 200 / (hk + 1.8), c: [m[0], G.ground + (hk + 1.2) / 2, m[2]] }, box: [k * cw, top + row * ch, cw, ch], label: `${who} ${view === 'side' ? 'left' : view} ${lab} · ${x.shown}${LEGS ? ` · legs ${x.legs}` : ''}` });
      });
      row++;
    }
  }
  await shoot(9 * cw, top + row * ch, cells, join(out, `leather-boots-${tag}-feet.png`), { texts: [{ css: 'left:10px;top:6px', html: `Leather boots, ${tag}: the game's walk (eight keys) and idle, side and front; the number: the boots' triangles crossing the body's` }] });
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
  await shoot(k * cw, top + ch, cells, join(out, `leather-boots-${tag}-full.png`), { texts: [{ css: 'left:10px;top:6px', html: `Leather boots, ${tag}: both bodies whole at the game's heights (she is 0.85 of him)` }] });
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
      cells.push({ meshes: dressed(who, d, bodyMesh(who, d.PB, G.ground + hk + 1.6), bootMesh(who, d.PG), 'plain', (m) => ({ ...m, tris: m.tris.filter((t) => m.P[t[0]][1] < G.ground + hk + 1.6) })), cam: { yaw, pitch: 6, s: 230 / (hk + 2), c: [m[0], G.ground + (hk + 1.2) / 2, m[2]] }, box: [i++ * cw, 0, cw, ch] });
    }
    await shoot(cw * 4, ch, cells, join(frames, `f${String(k).padStart(2, '0')}.png`));
  }
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=90, loop=0)
`, frames, join(out, `leather-boots-${tag}-walk.gif`)]);
  rmSync(frames, { recursive: true, force: true });
  console.log('wrote', join(out, `leather-boots-${tag}-walk.gif`));
}
rmSync(join(out, 'game'), { recursive: true, force: true });
await closeBrowser();
