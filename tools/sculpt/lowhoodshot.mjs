// The hood (tools/sculpt/garments/hood.mjs) on the low-poly bodies, worn with the shawl, looked over against the hood
// sheet and in the rig's poses:
//
//   node tools/sculpt/lowhoodshot.mjs --out <dir> [--only sheet,close,wire,poses,walk,metrics] [--sheet <hood sheet png>]
//        [--tag <name>] [--mono] [--plain] [--shawl] [--title <text>]
//     hood-sheet<tag>.png: the sheet's five views (0, 45, 90, 135, 180) of each body's hood beside the model's, hers above
//       his (--mono: the shell one colour, the border plain; --plain: no teeth; --shawl: the shawl drawn too);
//     hood-wire<tag>.png: the same views with every polygon's outline, and the triangle counts;
//     hood-poses<tag>.png: the test poses (arms out, forward, overhead, head turned 40 and 70, nodded down and back, the
//       game's walk and idle), each with the hood's triangles crossing the head's and the shawl's;
//     hood-walk<tag>.gif: the game's walk, both bodies, front, three-quarter, side, back;
//     hood-metrics.json: the checks at rest and in every pose, each body: the hood against the body, against the shawl,
//       itself, and the face's points hidden behind the hood (looking out along the head's forward).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { buildRig, posed, skin, fromGame, gameRig, armsOut, axisAngle, mm, tr, mv } from './lowrig.mjs';
import { skinGarment, checks, crossPairs, garmentAsset, bonesWith, sub, dot, cross } from './lowgarment.mjs';
import { MATS as SHAWL_MATS } from './garments/shawl.mjs';
import { buildOutfit } from './garments/outfit1.mjs';
import { buildHood, hoodWeights, MATS } from './garments/hood.mjs';
import { shoot, closeBrowser } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowhood'));
const only = opt('only', 'sheet,wire,poses,walk,metrics').split(',');
const tag = opt('tag', '');
const SHEET = resolve(opt('sheet', '/tmp/claude-0/-home-user-Wurm/781c435a-4202-5724-9056-b83f4c44c414/scratchpad/hood/hood-sheet.png'));
const withShawl = flag('shawl');
mkdirSync(out, { recursive: true });

const SKIN = [0.68, 0.49, 0.41];
const bodyMesh = (rig, P) => ({ who: rig.who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) });
const garMesh = (rig, G, P, mats, edges = false) => ({ who: rig.who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => mats[p.mat]), edges, edgec: [0.2, 0.12, 0.1] });

const M = {};
for (const who of ['male', 'female']) {
  // (the shawl as the outfit wears it, over the tunic: garments/outfit1.mjs)
  const rig = buildRig(who), O = buildOutfit(rig), S = O.shawl;
  const G = buildHood(rig, S, undefined, { mono: flag('mono'), plain: flag('plain'), under: [O.tunic] });
  G.vw = hoodWeights(rig, G, S);
  M[who] = { rig, S, G };
}

/* ---- checks ----------------------------------------------------------------------------------------------------------- */
const headIdx = (rig) => new Set(rig.B.verts.map((_, i) => i).filter((i) => rig.B.part[i] === 'head' || rig.B.part[i] === 'neck'));
/** The face's points from the eyes down (eyes, lids, nose, mouth, chin, cheeks), by name: the hood hangs to the brow. */
const FACE = /^(pupil|lid|tc|tb|k[0-3]|e[1-3]|jl)/;
const faceIdx = (rig) => rig.B.names.map((n, i) => (FACE.test(n ?? '') ? i : -1)).filter((i) => i >= 0);
/** Whether the ray from p along d meets triangle abc. */
function rayHits(p, d, a, b, c) {
  const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-12) return false;
  const f = 1 / det, s = sub(p, a), u = f * dot(s, h); if (u < 0 || u > 1) return false;
  const q = cross(s, e1), v = f * dot(d, q); if (v < 0 || u + v > 1) return false;
  return f * dot(e2, q) > 1e-6;
}
function measure(who, d, frames) {
  const { rig, S, G } = M[who];
  const c = checks(G, d.PG, rig.B, d.PB);
  const TS = S.tris.map((t) => ({ v: t.v })), TG = G.tris.map((t) => ({ v: t.v }));
  const withShawlN = crossPairs(d.PG, TG, d.PS, TS).length;
  // the face: each point's ray out along the head's forward
  const hb = rig.at.get('head'), fwd = mv(frames[hb].S, [0, 0, 1]);
  const hidden = faceIdx(rig).filter((i) => G.tris.some((t) => rayHits(d.PB[i], fwd, ...t.v.map((v) => d.PG[v])))).map((i) => rig.B.names[i]);
  // the head's own triangles against the hood's
  const H = headIdx(rig), headTris = rig.B.tris.filter((t) => t.v.every((i) => H.has(i)));
  const headN = crossPairs(d.PG, TG, d.PB, headTris).length;
  return { tris: c.tris, body: c.body, head: headN, self: c.self, shawl: withShawlN, faceHidden: hidden.length, hiddenNames: hidden.slice(0, 6), bodyParts: c.bodyParts, offPlane: c.offPlane, open: c.open, nonManifold: c.nonManifold };
}

/* ---- poses ---------------------------------------------------------------------------------------------------------- */
function testPoses(rig) {
  const W = (bone, axis, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const symW = (p, bone, axis, deg) => { p[`${bone}_l`] = mm(W(`${bone}_l`, axis, deg), p[`${bone}_l`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); p[`${bone}_r`] = mm(W(`${bone}_r`, [-axis[0], axis[1], axis[2]], -deg), p[`${bone}_r`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); return p; };
  const P = [
    { id: 'tpose', label: 'Arms out', pose: symW(symW({}, 'upperarm', Z, 74), 'lowerarm', Z, 10) },
    { id: 'forward', label: 'Arms forward', pose: symW(symW(symW({}, 'clavicle', Y, -14), 'upperarm', X, -84), 'upperarm', Y, -2) },
    { id: 'overhead', label: 'Arms overhead', pose: (() => { const p = symW(symW({}, 'clavicle', Z, 22), 'upperarm', Z, 140); return symW(p, 'lowerarm', Z, 8); })() },
    { id: 'turn40', label: 'Head turned 40°', pose: { neck_01: [0, 7, 0], neck_02: [0, 7, 0], head: [0, 26, 0] } },
    { id: 'turn40r', label: 'Head turned 40° right', pose: { neck_01: [0, -7, 0], neck_02: [0, -7, 0], head: [0, -26, 0] } },
    { id: 'turn70', label: 'Head turned 70°', pose: { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] } },
    { id: 'nod', label: 'Nod down 40°', pose: { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] } },
    { id: 'nod24', label: 'Nod down 24° (the idle\'s deepest bow)', pose: { neck_01: [7, 0, 0], neck_02: [8, 0, 0], head: [9, 0, 0] } },
    { id: 'nodup', label: 'Head back 20°', pose: { neck_01: [-6, 0, 0], neck_02: [-7, 0, 0], head: [-7, 0, 0] } },
    { id: 'turnnod', label: 'Turned 40°, nodded 24°', pose: { neck_01: [8, 7, 0], neck_02: [8, 7, 0], head: [8, 26, 0] } },
  ];
  if (rig.who === 'female') for (const e of P) e.pose = armsOut(rig, e.pose);
  return P;
}
const games = {};
async function game(rig) {
  if (games[rig.who]) return games[rig.who];
  const g = await gameRig(rig, join(out, 'game'));
  const at = (moving, u, t) => fromGame(rig, g.bonesOf(g.sculptRig({ phase: moving ? u * Math.PI * 2 : t * 6, moving, facing: 0, swimming: false, working: false, look: g.look }).rig, g.PROPS, [], g.REST_EXTRAS), g.gRest);
  return (games[rig.who] = { at });
}
function dress(who, pose) {
  const { rig, S, G } = M[who];
  const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G), PS = skinGarment(rig, f, S);
  const so = rig.B.names.map((n, i) => (/^so\d\.[LR]$/.test(n) ? i : -1)).filter((i) => i >= 0);
  const dy = rig.J.floor - Math.min(...so.map((i) => PB[i][1]));
  const sh = (P) => P.map((p) => [p[0], p[1] + dy, p[2]]);
  return { PB: sh(PB), PG: sh(PG), PS: sh(PS), dy, f };
}
const scene = (who, d, o = {}) => {
  const { rig, S, G } = M[who];
  const m = [bodyMesh(rig, d.PB)];
  if (o.shawl ?? withShawl) m.push(garMesh(rig, S, d.PS, SHAWL_MATS, o.edges));
  m.push(garMesh(rig, G, d.PG, MATS, o.edges));
  return m;
};

/* ---- the sheet: five views beside the sheet's ------------------------------------------------------------------------- */
// the sheet's views (hood-sheet.png, 1448 x 1086): her five centred at these x, his at these; the bust between y 112 and 318
const VIEWS = [[0, 'Front (0°)'], [45, 'Three-quarter (45°)'], [90, 'Profile (90°)'], [135, 'Rear three-quarter (135°)'], [180, 'Back (180°)']];
const SX = { female: [90, 229, 364, 507, 641], male: [813, 952, 1087, 1229, 1367] };
async function sheet(file, edges) {
  const cw = 270, ch = 360, top = 34, cells = [], imgs = [], texts = [];
  ['female', 'male'].forEach((who, r) => {
    const d = dress(who, {}), lift = -d.dy;
    const at = (P) => P.map((p) => [p[0], p[1] + lift, p[2]]);
    const d0 = { PB: at(d.PB), PG: at(d.PG), PS: at(d.PS) };
    VIEWS.forEach(([yaw, lab], i) => {
      imgs.push({ src: SHEET, size: [1448, 1086], crop: [SX[who][i] - 68, 112, 136, 206], box: [i * cw, top + r * 2 * (ch + 22), cw, ch] });
      cells.push({ meshes: scene(who, d0, { edges }), cam: { yaw, pitch: 0, s: 74, c: [0, 0.55, 0] }, box: [i * cw, top + (r * 2 + 1) * (ch + 22) - 22 + 22, cw, ch], label: `${who} ${lab}` });
    });
    texts.push({ cls: 'lab', css: `left:${5 * cw + 10}px;top:${top + r * 2 * (ch + 22) + 10}px`, html: `${who}: the sheet ↑` });
    texts.push({ cls: 'lab', css: `left:${5 * cw + 10}px;top:${top + (r * 2 + 1) * (ch + 22) + 10}px`, html: `${who}: the model ↑<br>${M[who].G.tris.length} triangles` });
  });
  texts.push({ css: 'left:10px;top:6px', html: opt('title', 'The hood on both low-poly bodies: the sheet\'s five views above each body\'s') });
  await shoot(5 * cw + 170, top + 4 * (ch + 22), cells, file, { texts, imgs });
}
/** Close: each body's front and profile at twice the sheet's scale, the sheet's beside each (`--only close`). */
async function close(file, edges) {
  const cw = 540, ch = 720, top = 34, cells = [], imgs = [], texts = [];
  ['male', 'female'].forEach((who, r) => {
    const d = dress(who, {}), lift = -d.dy;
    const at = (P) => P.map((p) => [p[0], p[1] + lift, p[2]]);
    const d0 = { PB: at(d.PB), PG: at(d.PG), PS: at(d.PS) };
    [0, 2].forEach((i, n) => {
      const [yaw, lab] = VIEWS[i];
      imgs.push({ src: SHEET, size: [1448, 1086], crop: [SX[who][i] - 68, 112, 136, 206], box: [n * 2 * cw, top + r * ch, cw, ch] });
      cells.push({ meshes: scene(who, d0, { edges }), cam: { yaw, pitch: 0, s: 148, c: [0, 0.55, 0] }, box: [(n * 2 + 1) * cw, top + r * ch, cw, ch], label: `${who} ${lab}` });
    });
  });
  texts.push({ css: 'left:10px;top:6px', html: opt('title', 'The hood close: the sheet\'s front and profile beside each body\'s') });
  await shoot(4 * cw, top + 2 * ch, cells, file, { texts, imgs });
}
if (only.includes('close')) await close(join(out, `hood-close${tag}.png`), false);
if (only.includes('sheet')) await sheet(join(out, `hood-sheet${tag}.png`), false);
if (only.includes('wire')) await sheet(join(out, `hood-wire${tag}.png`), true);

/* ---- poses and metrics ------------------------------------------------------------------------------------------------- */
const metrics = {};
if (only.includes('metrics') || only.includes('poses')) {
  for (const who of ['male', 'female']) {
    const { rig, G } = M[who];
    const g = await game(rig);
    const list = [{ id: 'rest', pose: {} }, ...testPoses(rig),
      ...Array.from({ length: 8 }, (_, k) => ({ id: `walk-${k}`, pose: g.at(true, k / 8) })),
      ...Array.from({ length: 16 }, (_, k) => ({ id: `idle-${k}`, pose: g.at(false, 0, k + 0.5) }))];
    metrics[who] = {};
    for (const e of list) { const d = dress(who, e.pose); metrics[who][e.id] = measure(who, d, d.f); }
    console.log(who, Object.entries(metrics[who]).map(([k, v]) => `${k}:${v.head}/${v.body}/${v.shawl}/${v.self}/${v.faceHidden}`).join(' '));
    metrics[who].bones = { body: rig.bones.length, garment: (G.bones ?? []).length, total: bonesWith(rig, G).length };
    writeFileSync(join(out, `hood-${who}.json`), JSON.stringify(garmentAsset(rig, G, MATS)));
  }
  writeFileSync(join(out, 'hood-metrics.json'), JSON.stringify(metrics, null, 1));
}
if (only.includes('poses')) {
  const cells = [], cw = 250, ch = 330, perRow = 6;
  const rows = [];
  for (const who of ['male', 'female']) {
    const g = await game(M[who].rig);
    rows.push([who, [{ id: 'rest', label: 'Rest', pose: {} }, ...testPoses(M[who].rig), { id: 'walk-2', label: 'Walk (3/8)', pose: g.at(true, 2 / 8) }, { id: 'idle-9', label: 'Idle look (t 9.5 s)', pose: g.at(false, 0, 9.5) }]]);
  }
  let n = 0;
  for (const [who, list] of rows) for (const e of list) {
    const d = dress(who, e.pose), m = metrics[who][e.id];
    for (const [j, yaw] of [[0, 0], [1, 45]]) {
      const k = n * 2 + j;
      cells.push({ meshes: scene(who, d, { shawl: true }), cam: { yaw, pitch: 4, s: 46, c: [0, 0.2 + d.dy - (e.id === 'overhead' ? 0 : 0), 0] }, box: [(k % (perRow * 2)) * cw, 34 + Math.floor(k / (perRow * 2)) * ch, cw, ch], label: j ? `head ${m.head} shawl ${m.shawl} face ${m.faceHidden}` : `${who} ${e.label}` });
    }
    n++;
  }
  const nr = Math.ceil((n * 2) / (perRow * 2));
  await shoot(perRow * 2 * cw, 34 + nr * ch, cells, join(out, `hood-poses${tag}.png`), { texts: [{ css: 'left:10px;top:6px', html: 'Test poses, front and 45°, with the shawl: the hood\'s triangles crossing the head\'s, crossing the shawl\'s, and face points hidden' }] });
}

/* ---- the walk ----------------------------------------------------------------------------------------------------------- */
if (only.includes('walk')) {
  const frames = join(out, 'walk-frames');
  mkdirSync(frames, { recursive: true });
  const cw = 200, ch = 420, F = 12;
  for (let k = 0; k < F; k++) {
    const cells = [];
    for (const [j, yaw] of [[0, 0], [1, 40], [2, 90], [3, 180]]) for (const [i, who] of [[0, 'male'], [1, 'female']]) {
      const g = await game(M[who].rig), d = dress(who, g.at(true, k / F)), sc = who === 'female' ? 0.85 : 1;
      const S = (P) => P.map((p) => [p[0] * sc, (p[1] - M[who].rig.J.floor) * sc, p[2] * sc]);
      cells.push({ meshes: scene(who, { PB: S(d.PB), PG: S(d.PG), PS: S(d.PS) }, { shawl: true }), cam: { yaw, pitch: 6, s: 27, c: [0, 7.4, 0] }, box: [(j * 2 + i) * cw, 0, cw, ch] });
    }
    await shoot(cw * 8, ch, cells, join(frames, `f${String(k).padStart(2, '0')}.png`));
  }
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr = [f.resize((f.width * 3 // 4, f.height * 3 // 4)) for f in fr]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=90, loop=0)
`, frames, join(out, `hood-walk${tag}.gif`)]);
  rmSync(frames, { recursive: true, force: true });
  console.log('wrote', join(out, `hood-walk${tag}.gif`));
}
await closeBrowser();
