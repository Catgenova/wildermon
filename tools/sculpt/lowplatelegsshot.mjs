// The plate leggings (tools/sculpt/garments/platelegs.mjs) on the low-poly bodies, looked over against their sheet and
// in the rig's poses:
//
//   node tools/sculpt/lowplatelegsshot.mjs --out <dir> [--stage 1..9] [--only sheet,wire,lineup,poses,walk,metrics,close]
//     platelegs-sheet-<who>.png: the sheet's five views (0, 45, 90, 135, 180) of that body's leggings above
//       (tools/sculpt/ref/plate-legs.png), the model below;
//     platelegs-wire-<who>.png: the same five views with the polygons' outlines, and the triangle counts;
//     platelegs-lineup.png: both bodies at the game's heights (she is 0.85 of him), front and three-quarter, the lineup above;
//     platelegs-close.png: the knee guard, the shin, the calf, the thigh and the hip band close up, both bodies;
//     platelegs-poses.png: rest, idle, the walk's keys, a deep stride, knee up, front and side, each with the plates'
//       triangles crossing the body's (and the base layer's) and each other's;
//     platelegs-walk.gif: the game's walk, both bodies, front, three-quarter and side;
//     platelegs-metrics.json: the checks at rest and in every pose.
//   --stage: 1 the blockout (one colour), 2 to 3 shaped in one colour, 4 and on coloured.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { buildRig, posed, skin, fromGame, gameRig, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, crossPairs, bonesWith, offPlane, edgesOf } from './lowgarment.mjs';
import { buildWithBase, plateLegsWeights, MATS, GLOW } from './garments/platelegs.mjs';
import { shoot, closeBrowser } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowplatelegs'));
const stage = +opt('stage', '9');
const only = opt('only', 'sheet,wire,lineup,close,poses,walk,metrics').split(',');
const tag = opt('tag', '');
mkdirSync(out, { recursive: true });
const DIR = new URL('.', import.meta.url).pathname;
const SHEET = join(DIR, 'ref/plate-legs.png'), LINEUP = join(DIR, 'ref/plate-lineup.png');

const SKIN = [0.68, 0.49, 0.41];
// (the colours as drawn: one plate colour for the blockout and the shaping; the glow unlit)
const colOf = (m) => (stage < 4 ? (m === 'under' ? MATS.under : MATS.plate) : GLOW.includes(m) ? MATS[m].map((x) => x + 2) : MATS[m]);
const bodyMesh = (rig, P, hide = null) => {
  const tris = rig.B.tris.filter((t) => !hide || !hide.has(t.poly));
  return { who: rig.who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: tris.map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) };
};
const garMesh = (rig, G, P, edges = false) => ({ who: rig.who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => colOf(p.mat)), edges });

const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who);
  const G = buildWithBase(rig, undefined, { stage });
  G.vw = plateLegsWeights(rig, G);
  const hide = new Set(G.hides);
  const body = { ...rig.B, tris: rig.B.tris.filter((t) => !hide.has(t.poly)) };
  M[who] = { rig, G, hide, body };
}

/** The checks in a pose: the plates' triangles crossing the body's (less the hidden), the base layer's, and each other's (pairs of plates). */
const plateTris = (G) => G.tris.filter((t) => G.polys[t.poly].tag !== 'base');
const baseTris = (G) => G.tris.filter((t) => G.polys[t.poly].tag === 'base');
function crossings(who, PB, PG) {
  const { G, body } = M[who], T = plateTris(G), Tb = baseTris(G);
  const withBody = crossPairs(PG, T, PB, body.tris), withBase = crossPairs(PG, T, PG, Tb), self = crossPairs(PG, T);
  const parts = {};
  const name = (t) => `${G.polys[t.poly].tag}${G.verts[t.v[0]][0] < 0 ? 'R' : ''}`;
  for (const [i] of withBody) { const k = `${G.polys[T[i].poly].tag}×body`; parts[k] = (parts[k] ?? 0) + 1; }
  for (const [i] of withBase) { const k = `${G.polys[T[i].poly].tag}×base`; parts[k] = (parts[k] ?? 0) + 1; }
  for (const [i, j] of self) { const k = [G.polys[T[i].poly].tag, G.polys[T[j].poly].tag].sort().join('×'); parts[k] = (parts[k] ?? 0) + 1; }
  void name;
  return { body: withBody.length, base: withBase.length, self: self.length, parts };
}
function restChecks(who) {
  const { G } = M[who], e = edgesOf({ polys: G.polys.filter((p) => p.tag !== 'base') });
  const T = plateTris(G), byTag = {};
  for (const t of T) { const k = G.polys[t.poly].tag; byTag[k] = (byTag[k] ?? 0) + 1; }
  return { plateTris: T.length, baseTris: baseTris(G).length, byTag, offPlane: +Math.max(...G.polys.map((p) => offPlane(G.verts, p.v))).toFixed(4), open: e.open.length, nonManifold: e.nonManifold.length, hidden: M[who].hide.size, bones: bonesWith(M[who].rig, G).length };
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
    { id: 'stride', label: 'Deep stride', pose: one(one(one(one({}, 'thigh_l', X, 55), 'calf_l', X, -35), 'thigh_r', X, -35), 'calf_r', X, -40) },
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
/** Body and leggings in a pose, stood on the floor as ground() stands the body. */
function dress(who, pose) {
  const { rig, G } = M[who];
  const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G);
  const so = rig.B.names.map((n, i) => (/^so\d\.[LR]$/.test(n) ? i : -1)).filter((i) => i >= 0);
  const dy = rig.J.floor - Math.min(...so.map((i) => PB[i][1]));
  const sh = (P) => P.map((p) => [p[0], p[1] + dy, p[2]]);
  return { PB: sh(PB), PG: sh(PG), dy };
}
const scene = (who, d, { edges = false } = {}) => [bodyMesh(M[who].rig, d.PB, M[who].hide), garMesh(M[who].rig, M[who].G, d.PG, edges)];

/* ---- the sheet: five views against the reference --------------------------------------------------------------------- */
// (the sheet turns the figure to show its right side: our yaw the other way)
const VIEWS = [[0, 'Front (0°)', 113], [-45, 'Three-quarter (45°)', 268], [-90, 'Side (90°)', 405], [-135, 'Rear three-quarter (135°)', 553], [180, 'Back (180°)', 718]];
const TOPS = { male: -3.9, female: -3.55 };
async function sheet(who, edges, file) {
  // (the model at the sheet's scale: the band's top to the floor over the sheet's (about 230 px), in a cell of 440)
  const cw = 300, ch = 440, top = 34, d = dress(who, {}), floor = M[who].rig.J.floor, s = 400 / (TOPS[who] - floor), cy = (TOPS[who] + floor) / 2 - 0.1;
  const cells = [], imgs = [];
  const y0 = who === 'female' ? 428 : 92;
  VIEWS.forEach(([yaw, lab, x], i) => {
    imgs.push({ src: SHEET, size: [1536, 1024], crop: [x - 82, y0, 164, 250], box: [i * cw, top, cw, ch] });
    cells.push({ meshes: scene(who, { PB: d.PB.map((p) => [p[0], p[1] - d.dy, p[2]]), PG: d.PG.map((p) => [p[0], p[1] - d.dy, p[2]]) }, { edges }), cam: { yaw, pitch: 0, s, c: [0, cy, 0] }, box: [i * cw, top + ch + 24, cw, ch], label: lab });
  });
  const c = restChecks(who);
  const texts = [{ css: 'left:10px;top:6px', html: `Plate leggings on the low-poly ${who}${tag ? ' — ' + tag : ''}: the sheet above, the model below; plates ${c.plateTris} triangles${edges ? ' (' + Object.entries(c.byTag).map(([k, v]) => `${k} ${v}`).join(', ') + ')' : ''}, base layer ${c.baseTris} (the body's own, hidden under it)` }];
  await shoot(5 * cw, top + 2 * ch + 24, cells, file, { texts, imgs });
}
if (only.includes('sheet')) for (const who of ['male', 'female']) await sheet(who, false, join(out, `platelegs-sheet-${who}.png`));
if (only.includes('wire')) for (const who of ['male', 'female']) await sheet(who, true, join(out, `platelegs-wire-${who}.png`));

/* ---- the lineup: both bodies standing, the game's heights ----------------------------------------------------------- */
if (only.includes('lineup')) {
  const H = Math.round(1061 * 0.5), cw = 1482 * 0.5 / 4, top = 34;
  const cells = [], imgs = [{ src: LINEUP, size: [1482, 1061], crop: [0, 0, 1482, 1061], box: [0, top, 4 * cw, H] }];
  const sc = { male: 1, female: 0.85 };
  [['male', 0], ['female', 0], ['male', -40], ['female', -40]].forEach(([who, yaw], i) => {
    const d = dress(who, {}), k = sc[who];
    const S = (P) => P.map((p) => [p[0] * k, (p[1] - M[who].rig.J.floor) * k, p[2] * k]);
    const s = H / 15.4;
    cells.push({ meshes: scene(who, { PB: S(d.PB), PG: S(d.PG) }), cam: { yaw, pitch: 0, s, c: [0, (H - 26) / 2 / s, 0] }, box: [i * cw, top + H + 20, cw, H], label: `${who} ${yaw ? '3/4' : 'front'}` });
  });
  await shoot(4 * cw, top + 2 * H + 20, cells, join(out, 'platelegs-lineup.png'), { imgs, texts: [{ css: 'left:10px;top:6px', html: 'The plate leggings on both bodies at the game\'s heights (she is 0.85 of him), the reference lineup above' }] });
}

/* ---- close up: the knee, the shin, the calf, the thigh, the band ----------------------------------------------------- */
if (only.includes('close')) {
  const cw = 300, ch = 340, cells = [], imgs = [];
  // (the sheet's key details: knee front and side, thigh, shin front and side, calf)
  const det = { male: [[878, 100], [1017, 100], [1155, 100], [878, 238], [1017, 238], [1155, 238]], female: [[880, 437], [1019, 437], [1157, 437], [880, 570], [1019, 570], [1157, 570]] };
  const views = (who) => { const D = M[who].G.design, y0 = (r) => (typeof r.y === 'number' ? r.y : r.y[0]), shin = (y0(D.shinUp.rows[0]) + y0(D.shinLow.rows.at(-1))) / 2; return [
    ['Knee guard (front)', 0, D.knee.mid, 2.4], ['Knee guard (side)', -90, D.knee.mid, 2.4], ['Thigh plate', -30, (y0(D.cuisse.rows.at(-1)) + D.band.bottom[3]) / 2, 3.6],
    ['Shin plate (front)', 0, shin, 4], ['Shin plate (side)', -90, shin, 4], ['Calf / back', 180, (D.calf.segs[0][0] + D.calf.segs[2][1]) / 2, 3.6],
    ['Hip band (front)', 0, (D.band.top[0] + D.band.bottom[0]) / 2, 3.4], ['Hip band (back)', 180, (D.band.top[0] + D.band.bottom[5]) / 2, 3.4],
  ]; };
  ['male', 'female'].forEach((who, r) => {
    const d = dress(who, {}), x0 = who === 'male' ? 0.95 : 0.95;
    views(who).forEach(([lab, yaw, y, span], k) => {
      const box = [k * cw, 34 + r * (ch * 2 + 10) + ch, cw, ch];
      if (k < 6) imgs.push({ src: SHEET, size: [1536, 1024], crop: [det[who][k][0] - 62, det[who][k][1], 124, 94], box: [k * cw, 34 + r * (ch * 2 + 10), cw, ch] });
      const cx = k >= 6 ? 0 : (yaw === 180 ? -x0 : x0);
      cells.push({ meshes: scene(who, { PB: d.PB.map((p) => [p[0], p[1] - d.dy, p[2]]), PG: d.PG.map((p) => [p[0], p[1] - d.dy, p[2]]) }), cam: { yaw, pitch: 4, s: ch / span, c: [yaw === -90 ? 0 : cx, y, 0] }, box, label: `${who} ${lab}` });
    });
  });
  await shoot(8 * cw, 34 + 2 * (ch * 2 + 10), cells, join(out, 'platelegs-close.png'), { imgs, texts: [{ css: 'left:10px;top:6px', html: 'Close up: the sheet\'s key details above each body\'s, the model below (the left leg; the hip band front and back)' }] });
}

/* ---- metrics: every pose ------------------------------------------------------------------------------------------- */
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
    const list = await poseList(who);
    metrics[who] = { poses: {} };
    for (const e of list) { const d = dress(who, e.pose); metrics[who].poses[e.id] = crossings(who, d.PB, d.PG); }
    metrics.rest[who] = restChecks(who);
    const walk = Object.entries(metrics[who].poses).filter(([k]) => k.startsWith('walk')), parts = {};
    for (const [, v] of walk) for (const [k, n] of Object.entries(v.parts)) parts[k] = (parts[k] ?? 0) + n;
    metrics[who].walk = { body: walk.reduce((s, [, v]) => s + v.body, 0), base: walk.reduce((s, [, v]) => s + v.base, 0), self: walk.reduce((s, [, v]) => s + v.self, 0), parts };
    console.log(who, 'rest', JSON.stringify(metrics.rest[who]));
    console.log(who, Object.entries(metrics[who].poses).map(([k, v]) => `${k}:${v.body}/${v.base}/${v.self}`).join(' '));
    console.log(who, 'walk', JSON.stringify(metrics[who].walk));
  }
  writeFileSync(join(out, 'platelegs-metrics.json'), JSON.stringify(metrics, null, 1));
}

if (only.includes('poses')) {
  const cells = [], cw = 200, ch = 380, rows = [];
  for (const who of ['male', 'female']) {
    const all = await poseList(who), pick = ['rest', 'walk-0', 'walk-2', 'walk-4', 'walk-6', 'walk-8', 'walk-10', 'walk-12', 'stride', 'kneel'];
    rows.push([who, pick.map((id) => all.find((e) => e.id === id))]);
  }
  rows.forEach(([who, list], r) => list.forEach((e, k) => {
    const d = dress(who, e.pose), m = metrics[who].poses[e.id], top = TOPS[who] + 0.6, bot = M[who].rig.J.floor;
    for (const [j, yaw] of [[0, 20], [1, -90]]) cells.push({ meshes: scene(who, d), cam: { yaw, pitch: 4, s: ch / (top - bot + 1), c: [0, (top + bot) / 2, 0] }, box: [(k % 5) * cw * 2 + j * cw, 34 + (r * 2 + Math.floor(k / 5)) * ch, cw, ch], label: j ? `${m.body}/${m.base}/${m.self}` : `${who} ${e.label}` });
  }));
  await shoot(5 * cw * 2, 34 + 4 * ch, cells, join(out, 'platelegs-poses.png'), { texts: [{ css: 'left:10px;top:6px', html: 'Poses, front-left and side: the plates\' triangles crossing the body\'s / the base layer\'s / each other\'s' }] });
}

/* ---- the walk: a GIF of both bodies, front, three-quarter, side ----------------------------------------------------- */
if (only.includes('walk')) {
  const frames = join(out, 'walk-frames');
  mkdirSync(frames, { recursive: true });
  const cw = 200, ch = 420, F = 12;
  for (let k = 0; k < F; k++) {
    const cells = [];
    for (const [j, yaw] of [[0, 0], [1, -40], [2, -90]]) for (const [i, who] of [[0, 'male'], [1, 'female']]) {
      const g = await game(M[who].rig), d = dress(who, g.at(true, k / F)), sc = who === 'female' ? 0.85 : 1;
      const S = (P) => P.map((p) => [p[0] * sc, (p[1] - M[who].rig.J.floor) * sc, p[2] * sc]);
      cells.push({ meshes: scene(who, { PB: S(d.PB), PG: S(d.PG) }), cam: { yaw, pitch: 6, s: 50, c: [0, 4.4, 0] }, box: [(j * 2 + i) * cw, 0, cw, ch] });
    }
    await shoot(cw * 6, ch, cells, join(frames, `f${String(k).padStart(2, '0')}.png`));
  }
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr = [f.resize((f.width * 3 // 4, f.height * 3 // 4)) for f in fr]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=90, loop=0)
`, frames, join(out, 'platelegs-walk.gif')]);
  rmSync(frames, { recursive: true, force: true });
  console.log('wrote', join(out, 'platelegs-walk.gif'));
}
await closeBrowser();
