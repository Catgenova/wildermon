// The trousers (tools/sculpt/garments/trousers.mjs) on the low-poly bodies, looked over against their references and in
// the rig's poses:
//
//   node tools/sculpt/lowtrousersshot.mjs --out <dir> [--stage 1..9] [--only sheet,wire,lineup,poses,shawl,walk,metrics]
//     trousers-sheet-<who>.png: the sheet's five views (0, 45, 90, 135, 180) of that body's trousers above
//       (tools/sculpt/ref/outfit1-trousers.png), the model below;
//     trousers-wire-<who>.png: the same five views with the polygons' outlines, and the triangle count;
//     trousers-lineup.png: both bodies at the game's heights (she is 0.85 of him), front and three-quarter, the lineup above;
//     trousers-poses.png: rest, idle, the walk's widest keys, a deep stride, arms out and arms forward, front and side,
//       each with the cloth's triangles crossing the body's (the body's covered polygons left out) and its own;
//     trousers-shawl.png: worn with the shawl, five views and the walk, each with the crossings between the two;
//     trousers-walk.gif: the game's walk, both bodies, front, three-quarter and side;
//     trousers-metrics.json: the checks at rest and in every pose, the hip's and the crotch's volume through the walk.
//   --stage: 1 the blockout (crotch, knee and cuff rings; one colour), 2 to 3 shaped in one colour, 4 and on coloured.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { buildRig, posed, skin, fromGame, gameRig, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, checks, crossPairs, trisOf, bonesWith, dot, cross, sub } from './lowgarment.mjs';
import { buildTrousers, trousersWeights, hiddenPolys, MATS } from './garments/trousers.mjs';
import { buildShawl, shawlWeights, MATS as SHAWL_MATS } from './garments/shawl.mjs';
import { shoot, closeBrowser } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowtrousers'));
const stage = +opt('stage', '9');
const only = opt('only', 'sheet,wire,lineup,poses,shawl,walk,metrics').split(',');
const tag = opt('tag', '');
mkdirSync(out, { recursive: true });
const DIR = new URL('.', import.meta.url).pathname;
const SHEET = join(DIR, 'ref/outfit1-trousers.png'), LINEUP = join(DIR, 'ref/outfit1-lineup.png');

const SKIN = [0.68, 0.49, 0.41];
const bodyMesh = (rig, P, hide = null) => {
  const tris = rig.B.tris.filter((t) => !hide || !hide.has(t.poly));
  return { who: rig.who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: tris.map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) };
};
const garMesh = (rig, G, P, mats, edges = false) => ({ who: rig.who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => mats[p.mat]), edges });

const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who);
  const G = buildTrousers(rig, undefined, { stage });
  G.vw = trousersWeights(rig, G);
  const hide = new Set(hiddenPolys(rig, G));
  const body = { ...rig.B, tris: rig.B.tris.filter((t) => !hide.has(t.poly)) };
  const Sh = buildShawl(rig);
  Sh.vw = shawlWeights(rig, Sh);
  M[who] = { rig, G, hide, body, Sh };
  console.log(who, 'rest', JSON.stringify(checks(G, G.verts, body, rig.B.verts)), `hidden ${hide.size} of ${rig.B.polys.length} body polygons`);
}

/* ---- poses ---------------------------------------------------------------------------------------------------------- */
const I = [1, 0, 0, 0, 1, 0, 0, 0, 1], X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
function testPoses(rig) {
  const W = (bone, axis, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
  const symW = (p, bone, axis, deg) => { p[`${bone}_l`] = mm(W(`${bone}_l`, axis, deg), p[`${bone}_l`] ?? I); p[`${bone}_r`] = mm(W(`${bone}_r`, [-axis[0], axis[1], axis[2]], -deg), p[`${bone}_r`] ?? I); return p; };
  const one = (p, bone, axis, deg) => { p[bone] = mm(W(bone, axis, deg), p[bone] ?? I); return p; };
  const P = [
    { id: 'tpose', label: 'Arms out', pose: symW(symW({}, 'upperarm', Z, 74), 'lowerarm', Z, 10) },
    { id: 'forward', label: 'Arms forward', pose: symW(symW(symW({}, 'clavicle', Y, -14), 'upperarm', X, -84), 'upperarm', Y, -2) },
    // a deep stride: the left thigh 55° forward, its knee bent 35°; the right 35° back, its knee 40°
    { id: 'stride', label: 'Deep stride', pose: one(one(one(one({}, 'thigh_l', X, 55), 'calf_l', X, -35), 'thigh_r', X, -35), 'calf_r', X, -40) },
    { id: 'stride2', label: 'Deep stride, the other leg', pose: one(one(one(one({}, 'thigh_r', X, 55), 'calf_r', X, -35), 'thigh_l', X, -35), 'calf_l', X, -40) },
    { id: 'kneel', label: 'Knee up 80°', pose: one(one({}, 'thigh_l', X, 80), 'calf_l', X, -90) },
  ];
  if (rig.who === 'female') for (const e of P) e.pose = armsOut(rig, e.pose);
  return P;
}
const games = {};
async function game(rig) {
  if (games[rig.who]) return games[rig.who];
  const g = await gameRig(rig, join(out, 'game'));
  const at = (moving, u) => fromGame(rig, g.bonesOf(g.sculptRig({ phase: u * Math.PI * 2, moving, facing: 0, swimming: false, working: false, look: g.look }).rig, g.PROPS, [], g.REST_EXTRAS), g.gRest);
  return (games[rig.who] = { at });
}
/** Body, trousers and shawl in a pose, stood on the floor as ground() stands the body. */
function dress(who, pose) {
  const { rig, G, Sh } = M[who];
  const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G), PS = skinGarment(rig, f, Sh);
  const so = rig.B.names.map((n, i) => (/^so\d\.[LR]$/.test(n) ? i : -1)).filter((i) => i >= 0);
  const dy = rig.J.floor - Math.min(...so.map((i) => PB[i][1]));
  const sh = (P) => P.map((p) => [p[0], p[1] + dy, p[2]]);
  return { PB: sh(PB), PG: sh(PG), PS: sh(PS), dy };
}
const scene = (who, d, { shawl = false, edges = false } = {}) => [bodyMesh(M[who].rig, d.PB, M[who].hide), garMesh(M[who].rig, M[who].G, d.PG, MATS, edges), ...(shawl ? [garMesh(M[who].rig, M[who].Sh, d.PS, SHAWL_MATS)] : [])];

/** The volume (signed, by the divergence theorem) of the trousers' surface between two heights at rest, closed by caps. */
function volumes(G, P) {
  // the hip: the hip's rings and the crotch row, capped at the rim and at the crotch row (each leg's top a fan to its middle)
  const R = G.rows, vol = (tris) => tris.reduce((s, [a, b, c]) => s + dot(a, cross(b, c)), 0) / 6;
  const ringTris = (A, Bq) => A.flatMap((_, k) => { const j = (k + 1) % A.length; return [[P[A[k]], P[A[j]], P[Bq[j]]], [P[A[k]], P[Bq[j]], P[Bq[k]]]]; });
  const cap = (A, flip) => { const c = A.reduce((s, i) => s.map((x, j) => x + P[i][j] / A.length), [0, 0, 0]); return A.map((_, k) => { const a = P[A[k]], b = P[A[(k + 1) % A.length]]; return flip ? [c, b, a] : [c, a, b]; }); };
  // (each piece closed: a band's ring A capped the other way round from its edges, ring B the same way)
  const H = ['C', 'H2', 'H1'];
  const hip = [];
  for (let i = 0; i + 1 < H.length; i++) hip.push(...ringTris(R.hip[H[i]], R.hip[H[i + 1]]));
  hip.push(...cap(R.hip.C, true), ...cap(R.hip.H1, false));
  // the crotch and the thighs: the crotch row to the stripe's top, each leg closed the same way
  let thighs = 0;
  for (const s of ['l', 'r']) { const L = R.leg[s]; if (L.S1) thighs += Math.abs(vol([...ringTris(L.C, L.S1), ...cap(L.C, true), ...cap(L.S1, false)])); }
  return { hip: Math.abs(vol(hip)), thighs };
}

/* ---- the sheet: five views against the reference --------------------------------------------------------------------- */
// (the sheet turns the figure to show its right side: our yaw the other way)
const VIEWS = [[0, 'Front (0°)', 105], [-45, 'Three-quarter (45°)', 268], [-90, 'Profile (90°)', 407], [-135, 'Rear three-quarter (135°)', 556], [180, 'Back (180°)', 720]];
const frame = (who) => { const D = M[who].G.design; return { cy: (D.waist + D.cuff[1]) / 2, h: D.waist - D.cuff[1] + 1.6 }; };
async function sheet(who, edges, file) {
  // (the model at the sheet's scale: its waist to its cuff over the sheet's (about 228 px of the sheet, 1.76 times in the
  // cell), its waist where the sheet's is)
  const cw = 300, ch = 440, top = 34, D = M[who].G.design, s = 380 / (D.waist - D.cuff[1]), cy = D.waist - (ch / 2 - 44) / s;
  const d = dress(who, {}), lift = -d.dy;
  const cells = [], imgs = [];
  const y0 = who === 'female' ? 100 : 452;
  VIEWS.forEach(([yaw, lab, x], i) => {
    imgs.push({ src: SHEET, size: [1536, 1024], crop: [x - 85, y0, 170, 250], box: [i * cw, top, cw, ch] });
    cells.push({ meshes: scene(who, { PB: d.PB.map((p) => [p[0], p[1] + lift, p[2]]), PG: d.PG.map((p) => [p[0], p[1] + lift, p[2]]) }, { edges }), cam: { yaw, pitch: 0, s, c: [0, cy, 0] }, box: [i * cw, top + ch + 24, cw, ch], label: lab });
  });
  const G = M[who].G;
  const texts = [{ css: 'left:10px;top:6px', html: `Trousers on the low-poly ${who}${tag ? ' — ' + tag : ''}: the sheet (tools/sculpt/ref/outfit1-trousers.png) above, the model below; ${G.tris.length} triangles, ${G.verts.length} vertices` }];
  await shoot(5 * cw, top + 2 * ch + 24, cells, file, { texts, imgs });
}
if (only.includes('sheet')) for (const who of ['male', 'female']) await sheet(who, false, join(out, `trousers-sheet-${who}.png`));
if (only.includes('wire')) for (const who of ['male', 'female']) await sheet(who, true, join(out, `trousers-wire-${who}.png`));

/* ---- the lineup: both bodies standing, the game's heights ----------------------------------------------------------- */
if (only.includes('lineup')) {
  const H = Math.round(1061 * 0.62), cw = 330, top = 34;
  const cells = [], imgs = [{ src: LINEUP, size: [1482, 1061], crop: [0, 0, 1482, 1061], box: [0, top, 4 * cw, H] }];
  const sc = { male: 1, female: 0.85 };
  [['male', 0], ['female', 0], ['male', 40], ['female', 40]].forEach(([who, yaw], i) => {
    const d = dress(who, {}), k = sc[who];
    const S = (P) => P.map((p) => [p[0] * k, (p[1] - M[who].rig.J.floor) * k, p[2] * k]);
    const s = 0.62 * 1000 / 14.0 * 0.98;
    cells.push({ meshes: scene(who, { PB: S(d.PB), PG: S(d.PG), PS: S(d.PS) }, { shawl: stage >= 7 }), cam: { yaw, pitch: 0, s, c: [0, (H - 20) / 2 / s, 0] }, box: [i * cw, top + H + 20, cw, H], label: `${who} ${yaw ? '3/4' : 'front'}` });
  });
  await shoot(4 * cw, top + 2 * H + 20, cells, join(out, 'trousers-lineup.png'), { imgs, texts: [{ css: 'left:10px;top:6px', html: 'The trousers on both bodies at the game\'s heights (she is 0.85 of him), the reference lineup above' }] });
}

/* ---- metrics: every pose, the walk's volumes -------------------------------------------------------------------------- */
const metrics = { stage, rest: {} };
async function poseList(who) {
  const { rig } = M[who], g = await game(rig);
  return [
    { id: 'rest', label: 'Rest', pose: {} },
    ...Array.from({ length: 4 }, (_, k) => ({ id: `idle-${k}`, label: `Idle ${k}`, pose: g.at(false, k * 0.12) })),
    ...Array.from({ length: 16 }, (_, k) => ({ id: `walk-${k}`, label: `Walk ${k}/16`, pose: g.at(true, k / 16) })),
    ...testPoses(rig),
  ];
}
if (only.includes('metrics') || only.includes('poses')) {
  for (const who of ['male', 'female']) {
    const { rig, G, body, Sh } = M[who];
    const list = await poseList(who);
    metrics[who] = { poses: {} };
    const v0 = volumes(G, G.verts);
    for (const e of list) {
      const d = dress(who, e.pose), c = checks(G, d.PG, body, d.PB), v = volumes(G, d.PG);
      const withShawl = crossPairs(d.PG, G.tris, d.PS, Sh.tris).length;
      metrics[who].poses[e.id] = { body: c.body, self: c.self, shawl: withShawl, bodyParts: c.bodyParts, selfParts: c.selfParts, hipVolume: +(v.hip / v0.hip).toFixed(3), crotchVolume: +(v.thighs / v0.thighs).toFixed(3) };
    }
    metrics.rest[who] = { ...checks(G, G.verts, body, rig.B.verts), hidden: M[who].hide.size, volume: { hip: +v0.hip.toFixed(3), crotchAndThighs: +v0.thighs.toFixed(3) }, bones: bonesWith(rig, G).length };
    const walk = Object.entries(metrics[who].poses).filter(([k]) => k.startsWith('walk'));
    metrics[who].walk = {
      body: walk.reduce((s, [, v]) => s + v.body, 0), self: walk.reduce((s, [, v]) => s + v.self, 0), shawl: walk.reduce((s, [, v]) => s + v.shawl, 0),
      hipVolume: [Math.min(...walk.map(([, v]) => v.hipVolume)), Math.max(...walk.map(([, v]) => v.hipVolume))],
      crotchVolume: [Math.min(...walk.map(([, v]) => v.crotchVolume)), Math.max(...walk.map(([, v]) => v.crotchVolume))],
    };
    console.log(who, Object.entries(metrics[who].poses).map(([k, v]) => `${k}:${v.body}/${v.self}/${v.shawl}`).join(' '));
    console.log(who, 'walk', JSON.stringify(metrics[who].walk));
  }
  writeFileSync(join(out, 'trousers-metrics.json'), JSON.stringify(metrics, null, 1));
}

if (only.includes('poses')) {
  const cells = [], cw = 230, ch = 400, rows = [];
  for (const who of ['male', 'female']) {
    const all = await poseList(who), pick = ['rest', 'idle-1', 'walk-0', 'walk-4', 'walk-8', 'walk-12', 'stride', 'kneel', 'tpose', 'forward'];
    rows.push([who, pick.map((id) => all.find((e) => e.id === id))]);
  }
  rows.forEach(([who, list], r) => list.forEach((e, k) => {
    const d = dress(who, e.pose), m = metrics[who].poses[e.id], { cy, h } = frame(who);
    for (const [j, yaw] of [[0, 20], [1, 90]]) cells.push({ meshes: scene(who, d), cam: { yaw, pitch: 4, s: ch / (h + 1.5), c: [0, cy + d.dy - 0.4, 0] }, box: [(k % 5) * cw * 2 + j * cw, 34 + (r * 2 + Math.floor(k / 5)) * ch, cw, ch], label: j ? `body ${m.body}, self ${m.self}` : `${who} ${e.label}` });
  }));
  await shoot(5 * cw * 2, 34 + 4 * ch, cells, join(out, 'trousers-poses.png'), { texts: [{ css: 'left:10px;top:6px', html: 'Poses, front-left and side: the trousers\' triangles crossing the body\'s (its covered polygons left out), and their own crossing each other' }] });
}

/* ---- worn with the shawl --------------------------------------------------------------------------------------------- */
if (only.includes('shawl')) {
  const cw = 260, ch = 520, cells = [];
  for (const [r, who] of [[0, 'male'], [1, 'female']]) {
    const g = await game(M[who].rig);
    const list = [...VIEWS.map(([yaw, lab]) => ({ yaw, lab, pose: {} })), { yaw: 30, lab: 'Walk 1/4', pose: g.at(true, 0.25) }, { yaw: 90, lab: 'Walk 3/4, side', pose: g.at(true, 0.75) }];
    list.forEach((e, k) => {
      const d = dress(who, e.pose), n = crossPairs(d.PG, M[who].G.tris, d.PS, M[who].Sh.tris).length;
      const top = 2.4, bot = M[who].G.design.cuff[1] - 0.8, s = ch / (top - bot);
      cells.push({ meshes: scene(who, d, { shawl: true }), cam: { yaw: e.yaw, pitch: 4, s, c: [0, (top + bot) / 2 + d.dy, 0] }, box: [k * cw, 34 + r * ch, cw, ch], label: `${who} ${e.lab}: ${n} crossing the shawl` });
    });
  }
  await shoot(7 * cw, 34 + 2 * ch, cells, join(out, 'trousers-shawl.png'), { texts: [{ css: 'left:10px;top:6px', html: 'The trousers worn with the shawl: five views at rest and two keys of the walk, each with the triangles of the one crossing the other' }] });
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
      cells.push({ meshes: scene(who, { PB: S(d.PB), PG: S(d.PG), PS: S(d.PS) }, { shawl: stage >= 7 }), cam: { yaw, pitch: 6, s: 30, c: [0, 7.2, 0] }, box: [(j * 2 + i) * cw, 0, cw, ch] });
    }
    await shoot(cw * 6, ch, cells, join(frames, `f${String(k).padStart(2, '0')}.png`));
  }
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr = [f.resize((f.width * 2 // 3, f.height * 2 // 3)) for f in fr]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=90, loop=0)
`, frames, join(out, 'trousers-walk.gif')]);
  rmSync(frames, { recursive: true, force: true });
  console.log('wrote', join(out, 'trousers-walk.gif'));
}
await closeBrowser();
