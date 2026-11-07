// The shawl (tools/sculpt/garments/shawl.mjs) on the low-poly bodies, looked over against its references and in the
// rig's poses:
//
//   node tools/sculpt/lowshawlshot.mjs --out <dir> [--only sheet,lineup,poses,walk,metrics]
//     shawl-sheet-male.png, shawl-sheet-female.png: the sheet's five views (0, 45, 90, 135, 180), the reference above
//       (tools/sculpt/ref/outfit1-shawl.png; for her also tools/sculpt/ref/outfit1-lineup.png), the model below;
//     shawl-lineup.png: both bodies standing, front and three-quarter, at the game's heights (she is 0.85 of him), the
//       reference lineup above;
//     shawl-poses.png: the test poses (arms out, forward, overhead, head turned, the game's walk and idle), each with the
//       garment's triangles crossing the body's;
//     shawl-walk.gif: the game's walk, both bodies, front, three-quarter and side;
//     shawl-metrics.json: the checks at rest and in every pose, each body;
//     shawl-<who>.json: the garment as the game would load it beside its body (lowgarment.mjs garmentAsset), its own
//       bones (the cape's) driven from the body's pose.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { buildRig, posed, skin, fromGame, gameRig, armsOut, axisAngle, mm, tr, sym } from './lowrig.mjs';
import { skinGarment, checks, trisOf, garmentAsset, bonesWith } from './lowgarment.mjs';
import { buildShawl, shawlWeights, MATS } from './garments/shawl.mjs';
import { shoot, closeBrowser } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowshawl'));
const only = opt('only', 'sheet,lineup,poses,walk,metrics').split(',');
mkdirSync(out, { recursive: true });
const DIR = new URL('.', import.meta.url).pathname;
const SHEET = join(DIR, 'ref/outfit1-shawl.png'), LINEUP = join(DIR, 'ref/outfit1-lineup.png');

const SKIN = [0.68, 0.49, 0.41];
const bodyMesh = (rig, P) => ({ who: rig.who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) });
const garMesh = (rig, G, P) => ({ who: rig.who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => MATS[p.mat]) });

const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who);
  const G = buildShawl(rig);
  G.vw = shawlWeights(rig, G);
  M[who] = { rig, G };
  const c = checks(G, G.verts, rig.B, rig.B.verts);
  console.log(who, 'rest', JSON.stringify(c));
}
const metrics = { rest: Object.fromEntries(Object.entries(M).map(([w, { rig, G }]) => [w, checks(G, G.verts, rig.B, rig.B.verts)])) };

/* ---- poses ---------------------------------------------------------------------------------------------------------- */
const I = [1, 0, 0, 0, 1, 0, 0, 0, 1], X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
function testPoses(rig) {
  const W = (bone, axis, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
  const symW = (p, bone, axis, deg) => { p[`${bone}_l`] = mm(W(`${bone}_l`, axis, deg), p[`${bone}_l`] ?? I); p[`${bone}_r`] = mm(W(`${bone}_r`, [-axis[0], axis[1], axis[2]], -deg), p[`${bone}_r`] ?? I); return p; };
  const P = [
    { id: 'tpose', label: 'Arms out', pose: symW(symW({}, 'upperarm', Z, 74), 'lowerarm', Z, 10) },
    { id: 'forward', label: 'Arms forward', pose: symW(symW(symW({}, 'clavicle', Y, -14), 'upperarm', X, -84), 'upperarm', Y, -2) },
    { id: 'overhead', label: 'Arms overhead', pose: (() => { const p = symW(symW({}, 'clavicle', Z, 22), 'upperarm', Z, 140); return symW(p, 'lowerarm', Z, 8); })() },
    { id: 'headturn', label: 'Head turned 70°', pose: { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] } },
    { id: 'nod', label: 'Head nod 40°', pose: { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] } },
  ];
  if (rig.who === 'female') for (const e of P) e.pose = armsOut(rig, e.pose);
  return P;
}
const games = {};
async function game(rig) {
  if (games[rig.who]) return games[rig.who];
  const g = await gameRig(rig, join(out, 'game'));
  const at = (moving, u, gait) => fromGame(rig, g.bonesOf(g.sculptRig({ phase: u * Math.PI * 2, moving, facing: 0, swimming: false, working: false, look: g.look, ...(gait ? { gait } : {}) }).rig, g.PROPS, [], g.REST_EXTRAS), g.gRest);
  return (games[rig.who] = { at });
}
/** Body and garment in a pose, stood on the floor as ground() stands the body. */
function dress(who, pose) {
  const { rig, G } = M[who];
  const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G);
  const so = rig.B.names.map((n, i) => (/^so\d\.[LR]$/.test(n) ? i : -1)).filter((i) => i >= 0);
  const dy = rig.J.floor - Math.min(...so.map((i) => PB[i][1]));
  const sh = (P) => P.map((p) => [p[0], p[1] + dy, p[2]]);
  return { PB: sh(PB), PG: sh(PG), dy };
}
const scene = (who, d) => [bodyMesh(M[who].rig, d.PB), garMesh(M[who].rig, M[who].G, d.PG)];

/* ---- the sheet: five views against the reference --------------------------------------------------------------------- */
const VIEWS = [[0, 'Front (0°)', 163], [45, 'Three-quarter (45°)', 398], [90, 'Profile (90°)', 612], [135, 'Rear three-quarter (135°)', 838], [180, 'Back (180°)', 1052]];
if (only.includes('sheet')) for (const who of ['male', 'female']) {
  const cw = 440, ch = 600, k = cw / 250, s = 52 * k, top = 34;
  const d = dress(who, {}), lift = -d.dy; // the bust: the rest's own heights
  const cells = [], imgs = [];
  VIEWS.forEach(([yaw, lab, x], i) => {
    imgs.push({ src: SHEET, size: [1528, 425], crop: [x - 125, 45, 250, 340], box: [i * cw, top, cw, ch] });
    cells.push({ meshes: scene(who, { PB: d.PB.map((p) => [p[0], p[1] + lift, p[2]]), PG: d.PG.map((p) => [p[0], p[1] + lift, p[2]]) }), cam: { yaw, pitch: 0, s, c: [0, (172 - 215) / 52, 0] }, box: [i * cw, top + ch + 24, cw, ch], label: lab });
  });
  const texts = [{ css: `left:10px;top:6px`, html: `Shawl on the low-poly ${who}: the reference (tools/sculpt/ref/outfit1-shawl.png, on the male bust) above, the model below; ${M[who].G.tris.length} triangles` }];
  if (who === 'female') {
    // her own fit: the lineup's woman, front and three-quarter
    imgs.push({ src: LINEUP, size: [1482, 1061], crop: [470, 170, 260, 360], box: [5 * cw, top, 330, ch] });
    imgs.push({ src: LINEUP, size: [1482, 1061], crop: [1200, 195, 260, 360], box: [5 * cw, top + ch + 24, 330, ch] });
  }
  await shoot(5 * cw + (who === 'female' ? 330 : 0), top + 2 * ch + 24, cells, join(out, `shawl-sheet-${who}.png`), { texts, imgs });
}

if (only.includes('metrics') || only.includes('poses')) {
  for (const who of ['male', 'female']) {
    const { rig, G } = M[who];
    const g = await game(rig);
    const list = [...testPoses(rig), ...Array.from({ length: 8 }, (_, k) => ({ id: `walk-${k}`, pose: g.at(true, k / 8) })), ...Array.from({ length: 4 }, (_, k) => ({ id: `idle-${k}`, pose: g.at(false, k * 0.12) }))];
    metrics[who] = {};
    for (const e of list) { const d = dress(who, e.pose); const c = checks(G, d.PG, rig.B, d.PB); metrics[who][e.id] = { self: c.self, body: c.body, bodyParts: c.bodyParts, selfParts: c.selfParts }; }
    console.log(who, Object.entries(metrics[who]).map(([k, v]) => `${k}:${v.body}/${v.self}`).join(' '));
  }
  for (const who of ['male', 'female']) {
    const { rig, G } = M[who];
    writeFileSync(join(out, `shawl-${who}.json`), JSON.stringify(garmentAsset(rig, G, MATS)));
    metrics[who].bones = { body: rig.bones.length, garment: G.bones.length, total: bonesWith(rig, G).length, names: G.bones.map((b) => b.name) };
  }
  writeFileSync(join(out, 'shawl-metrics.json'), JSON.stringify(metrics, null, 1));
}

if (only.includes('poses')) {
  const cells = [], cw = 300, ch = 420, rows = [];
  for (const who of ['male', 'female']) {
    const { rig } = M[who], g = await game(rig);
    const list = [{ id: 'rest', label: 'Rest', pose: {} }, ...testPoses(rig), { id: 'walk-2', label: 'Walk (key 3/8)', pose: g.at(true, 2 / 8) }, { id: 'idle-1', label: 'Idle', pose: g.at(false, 0.12) }];
    rows.push([who, list]);
  }
  rows.forEach(([who, list], r) => list.forEach((e, k) => {
    const d = dress(who, e.pose), m = metrics[who][e.id] ?? metrics.rest[who];
    for (const [j, yaw] of [[0, 0], [1, 40]]) cells.push({ meshes: scene(who, d), cam: { yaw, pitch: 6, s: 62, c: [0, -1.6 + d.dy, 0] }, box: [(k % 4) * cw * 2 + j * cw, 34 + (r * 2 + Math.floor(k / 4)) * ch, cw, ch], label: j ? `crossings ${m.body}, self ${m.self}` : `${who} ${e.label}` });
  }));
  await shoot(4 * cw * 2, 34 + 4 * ch, cells, join(out, 'shawl-poses.png'), { texts: [{ css: 'left:10px;top:6px', html: 'Test poses, front and three-quarter: the shawl\'s triangles crossing the body\'s, and its own crossing each other' }] });
}

/* ---- the lineup: both bodies standing, the game's heights ----------------------------------------------------------- */
if (only.includes('lineup')) {
  const H = Math.round(1061 * 0.62), cw = 330, top = 34;
  const cells = [], imgs = [{ src: LINEUP, size: [1482, 1061], crop: [0, 0, 1482, 1061], box: [0, top, 4 * cw, H] }];
  // his height to the cell's: the floor at the bottom, the crown at the lineup's
  const sc = { male: 1, female: 0.85 };
  [['male', 0], ['female', 0], ['male', 40], ['female', 40]].forEach(([who, yaw], i) => {
    const d = dress(who, {}), k = sc[who];
    const S = (P) => P.map((p) => [p[0] * k, (p[1] - M[who].rig.J.floor) * k, p[2] * k]);
    const s = 0.62 * 1000 / 14.0 * 0.98;
    cells.push({ meshes: [{ ...bodyMesh(M[who].rig, S(d.PB)) }, garMesh(M[who].rig, M[who].G, S(d.PG))], cam: { yaw, pitch: 0, s, c: [0, (H - 20) / 2 / s, 0] }, box: [i * cw, top + H + 20, cw, H], label: `${who} ${yaw ? '3/4' : 'front'}` });
  });
  await shoot(4 * cw, top + 2 * H + 20, cells, join(out, 'shawl-lineup.png'), { imgs, texts: [{ css: 'left:10px;top:6px', html: 'The shawl on both bodies at the game\'s heights (she is 0.85 of him), the reference lineup above' }] });
}

/* ---- the walk: a GIF of both bodies, front, three-quarter, side ----------------------------------------------------- */
if (only.includes('walk')) {
  const frames = join(out, 'walk-frames');
  mkdirSync(frames, { recursive: true });
  const cw = 240, ch = 460, F = 12;
  for (let k = 0; k < F; k++) {
    const cells = [];
    for (const [j, yaw] of [[0, 0], [1, 40], [2, 90]]) for (const [i, who] of [[0, 'male'], [1, 'female']]) {
      const g = await game(M[who].rig), d = dress(who, g.at(true, k / F)), sc = who === 'female' ? 0.85 : 1;
      const S = (P) => P.map((p) => [p[0] * sc, (p[1] - M[who].rig.J.floor) * sc, p[2] * sc]);
      cells.push({ meshes: [bodyMesh(M[who].rig, S(d.PB)), garMesh(M[who].rig, M[who].G, S(d.PG))], cam: { yaw, pitch: 6, s: 30, c: [0, 7.2, 0] }, box: [(j * 2 + i) * cw, 0, cw, ch] });
    }
    await shoot(cw * 6, ch, cells, join(frames, `f${String(k).padStart(2, '0')}.png`));
  }
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr = [f.resize((f.width * 2 // 3, f.height * 2 // 3)) for f in fr]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=90, loop=0)
`, frames, join(out, 'shawl-walk.gif')]);
  rmSync(frames, { recursive: true, force: true });
  console.log('wrote', join(out, 'shawl-walk.gif'));
}
await closeBrowser();
