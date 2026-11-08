// The boots (tools/sculpt/garments/boots.mjs) on the low-poly bodies, looked over against their reference sheet
// (tools/sculpt/ref/outfit1-boots.png) and in the rig's poses:
//
//   node tools/sculpt/lowbootshot.mjs --out <dir> [--tag <name>] [--only sheet,wire,poses,feet,full,walk,shawl,metrics]
//     boots-<tag>-sheet.png: the sheet's five views (0, 45, 90, 135, 180) of both bodies' boots, each row of the sheet's
//       own views above the model's (her row first, as the sheet), the legs below the calf, the feet set as close as the
//       sheet sets them;
//     boots-<tag>-wire.png: the same with the polygons' outlines, and the triangle counts;
//     boots-<tag>-feet.png: the feet close up in the game's walk (eight keys) and idle, both bodies, side and front;
//     boots-<tag>-full.png: both bodies whole, standing, walking and idle, at the game's heights (she is 0.85 of him);
//     boots-<tag>-poses.png: the test poses (arms out, arms forward, the walk, idle), crossings counted under each;
//     boots-<tag>-shawl.png: worn with the shawl (tools/sculpt/garments/shawl.mjs), front, three-quarter, back;
//     boots-<tag>-walk.gif: the game's walk, both bodies, the feet close up from the side and the front;
//     boots-metrics.json: the checks at rest and in every pose, each body (crossings against the body's polygons the
//       boots leave showing, and against all of them).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { buildRig, posed, skin, fromGame, gameRig, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, checks, crossPairs } from './lowgarment.mjs';
import { buildBoots, bootWeights, MATS, DESIGN } from './garments/boots.mjs';
import { shoot, closeBrowser } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowboots'));
const tag = opt('tag', 'x');
const only = opt('only', 'sheet,metrics').split(',');
// (--design '{...}': settings over each body's DESIGN, for trying one out)
const over = JSON.parse(opt('design', '{}'));
mkdirSync(out, { recursive: true });
const DIR = new URL('.', import.meta.url).pathname;
const SHEET = join(DIR, 'ref/outfit1-boots.png');

const SKIN = [0.68, 0.49, 0.41];
const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who), G = buildBoots(rig, { ...DESIGN[who], ...over });
  G.vw = bootWeights(rig, G);
  const hidden = new Set(G.hides);
  // the body's triangles the boots leave showing
  const shown = rig.B.tris.filter((t) => !hidden.has(t.poly));
  M[who] = { rig, G, hidden, shown };
}
const bodyMesh = (who, P, cut = Infinity) => {
  const { rig, hidden } = M[who];
  const keep = rig.B.polys.map((p, pi) => !hidden.has(pi) && p.v.every((i) => P[i][1] < cut));
  return { who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.filter((t) => keep[t.poly]).map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) };
};
const bootMesh = (who, P) => { const { G } = M[who]; return { who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => MATS[p.mat]) }; };

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
/** The crossings of the boots' triangles with the body's: those it leaves showing, and all of them. */
function crossings(who, d) {
  const { rig, G, shown } = M[who];
  return { shown: crossPairs(d.PG, G.tris, d.PB, shown).length, all: crossPairs(d.PG, G.tris, d.PB, rig.B.tris).length };
}

/* ---- the sheet: five views of both bodies' boots, the sheet's own above each ---------------------------------------- */
// the sheet's views (outfit1-boots.png, 1536 x 1024): her row at y 112, his at 448
const CROPS = { female: [[22, 112, 200, 205], [228, 112, 170, 205], [382, 112, 152, 205], [533, 112, 210, 205], [738, 112, 128, 205]], male: [[18, 446, 207, 200], [228, 446, 175, 200], [392, 446, 155, 200], [540, 446, 210, 200], [745, 446, 125, 200]] };
const VIEWS = [[0, 'Front (0°)'], [-45, 'Three-quarter (45°)'], [-90, 'Profile (90°)'], [-135, 'Rear three-quarter (135°)'], [180, 'Back (180°)']];
async function sheet(file, wire) {
  const cw = 250, ch = 260, top = 34, cells = [], imgs = [], texts = [];
  ['female', 'male'].forEach((who, r) => {
    const { rig, G } = M[who], d = dress(who, {});
    // the feet set closer, as the sheet sets them: each side moved in by `pull`
    const pull = who === 'male' ? 0.55 : 0.7;
    const inn = (P, sideOf) => P.map((p, i) => [p[0] - Math.sign(sideOf(i, p)) * pull, p[1], p[2]]);
    const PB = inn(d.PB, (i) => rig.B.verts[i][0]), PG = inn(d.PG, (i) => (G.side[i] === 'L' ? 1 : -1));
    const ground = G.ground, cut = G.yCuff[1] + 0.35;
    const s = 88, c = [0, ground + 0.95, 0.05];
    VIEWS.forEach(([yaw, lab], i) => {
      imgs.push({ src: SHEET, size: [1536, 1024], crop: CROPS[who][i], box: [i * cw, top + r * 2 * ch, cw, ch] });
      const body = bodyMesh(who, PB, cut), boot = bootMesh(who, PG);
      if (wire) { body.edges = false; boot.edges = true; boot.edgec = [0.12, 0.07, 0.05]; }
      cells.push({ meshes: [body, boot], cam: { yaw, pitch: -14, s, c }, box: [i * cw, top + (r * 2 + 1) * ch, cw, ch], label: `${who} ${lab}` });
    });
    // the triangles by part (a boot)
    const parts = {};
    for (const t of G.tris) { const p = G.polys[t.poly]; if (G.side[p.v[0]] === 'L') parts[p.tag] = (parts[p.tag] ?? 0) + 1; }
    texts.push({ cls: 'lab', css: `left:${5 * cw + 10}px;top:${top + r * 2 * ch + (wire ? 250 : 10)}px;width:260px;white-space:normal`, html: `<b>${who}</b><br>${G.tris.length} triangles (${G.tris.length / 2} a boot)<br>above: the sheet; below: the model` + (wire ? '<br><br>a boot, by part:<br>' + Object.entries(parts).map(([k, v]) => `${k} ${v}`).join('<br>') : '') });
  });
  if (wire) imgs.push({ src: SHEET, size: [1536, 1024], crop: [612, 760, 262, 240], box: [5 * cw, top, 280, 240] });
  texts.push({ css: 'left:10px;top:6px', html: `Boots, ${tag}: the sheet (tools/sculpt/ref/outfit1-boots.png) above each body's row, the model below (the feet set as close as the sheet sets them)` });
  await shoot(5 * cw + 280, top + 4 * ch + (wire ? 120 : 0), cells, file, { texts, imgs });
}
if (only.includes('sheet')) await sheet(join(out, `boots-${tag}-sheet.png`), false);
if (only.includes('wire')) await sheet(join(out, `boots-${tag}-wire.png`), true);

/* ---- metrics -------------------------------------------------------------------------------------------------------- */
const metrics = {};
if (only.includes('metrics')) {
  for (const who of ['male', 'female']) {
    const { rig, G } = M[who], g = await game(who);
    const c = checks(G, G.verts, rig.B, rig.B.verts);
    const list = [{ id: 'rest', pose: {} }, ...testPoses(rig), ...Array.from({ length: 16 }, (_, k) => ({ id: `walk-${k}`, pose: g.at(true, k / 16) })), ...Array.from({ length: 6 }, (_, k) => ({ id: `idle-${k}`, pose: g.at(false, k * 0.12) }))];
    metrics[who] = { tris: c.tris, open: c.open, nonManifold: c.nonManifold, offPlane: c.offPlane, bones: rig.bones.length, poses: {} };
    for (const e of list) {
      const d = dress(who, e.pose), x = crossings(who, d), cc = checks(G, d.PG, rig.B, d.PB);
      // the soles: how far the lowest and highest sole vertex under each foot lie off the ground
      metrics[who].poses[e.id] = { body: x.shown, bodyAll: x.all, self: cc.self, selfParts: cc.selfParts };
    }
    console.log(who, JSON.stringify({ ...metrics[who], poses: undefined }), Object.entries(metrics[who].poses).map(([k, v]) => `${k}:${v.body}/${v.bodyAll}/${v.self}`).join(' '));
  }
  writeFileSync(join(out, 'boots-metrics.json'), JSON.stringify(metrics, null, 1));
}

/* ---- the feet in the walk and idle ------------------------------------------------------------------------------------ */
if (only.includes('feet')) {
  const cw = 230, ch = 210, top = 34, cells = [];
  let row = 0;
  for (const who of ['male', 'female']) {
    const g = await game(who), { G } = M[who];
    const keys = [...Array.from({ length: 8 }, (_, k) => [`walk ${k + 1}/8`, g.at(true, k / 8)]), ['idle', g.at(false, 0.12)]];
    for (const [yaw, view] of [[-90, 'side'], [0, 'front']]) {
      keys.forEach(([lab, pose], k) => {
        const d = dress(who, pose), x = crossings(who, d);
        cells.push({ meshes: [bodyMesh(who, d.PB, G.ground + 2.6), bootMesh(who, d.PG)], cam: { yaw, pitch: 8, s: 62, c: [0, G.ground + 0.9, 0] }, box: [k * cw, top + row * ch, cw, ch], label: `${who} ${view} ${lab} · ${x.shown}` });
      });
      row++;
    }
  }
  await shoot(9 * cw, top + row * ch, cells, join(out, `boots-${tag}-feet.png`), { texts: [{ css: 'left:10px;top:6px', html: `Boots, ${tag}: the game's walk (eight keys) and idle, side and front; the number: the boots' triangles crossing the body's` }] });
}

/* ---- both bodies whole --------------------------------------------------------------------------------------------- */
if (only.includes('full')) {
  const cw = 260, ch = 560, top = 34, cells = [];
  const sc = { male: 1, female: 0.85 };
  let k = 0;
  for (const who of ['male', 'female']) {
    const g = await game(who), { rig } = M[who];
    for (const [lab, pose, yaw] of [['rest', {}, 0], ['rest', {}, -40], ['walk', g.at(true, 0.25), -90], ['walk', g.at(true, 0.6), -40], ['idle', g.at(false, 0.12), -20]]) {
      const d = dress(who, pose), s = sc[who], G0 = M[who].G.ground;
      const S = (P) => P.map((p) => [p[0] * s, (p[1] - G0) * s, p[2] * s]);
      cells.push({ meshes: [bodyMesh(who, S(d.PB)), bootMesh(who, S(d.PG))], cam: { yaw, pitch: 4, s: 36, c: [0, 7.2, 0] }, box: [k * cw, top, cw, ch], label: `${who} ${lab}` });
      k++;
    }
  }
  await shoot(k * cw, top + ch, cells, join(out, `boots-${tag}-full.png`), { texts: [{ css: 'left:10px;top:6px', html: `Boots, ${tag}: both bodies whole at the game's heights (she is 0.85 of him)` }] });
}

/* ---- the walk as a GIF ---------------------------------------------------------------------------------------------- */
if (only.includes('walk')) {
  const frames = join(out, 'walk-frames');
  mkdirSync(frames, { recursive: true });
  const cw = 260, ch = 240, F = 16;
  for (let k = 0; k < F; k++) {
    const cells = [];
    let i = 0;
    for (const who of ['male', 'female']) for (const yaw of [-90, -30]) {
      const g = await game(who), d = dress(who, g.at(true, k / F)), G0 = M[who].G.ground;
      cells.push({ meshes: [bodyMesh(who, d.PB, G0 + 3), bootMesh(who, d.PG)], cam: { yaw, pitch: 6, s: 52, c: [0, G0 + 1.2, 0] }, box: [i++ * cw, 0, cw, ch] });
    }
    await shoot(cw * 4, ch, cells, join(frames, `f${String(k).padStart(2, '0')}.png`));
  }
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=90, loop=0)
`, frames, join(out, `boots-${tag}-walk.gif`)]);
  rmSync(frames, { recursive: true, force: true });
  console.log('wrote', join(out, `boots-${tag}-walk.gif`));
}
await closeBrowser();
