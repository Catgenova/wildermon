// The leather shawl (tools/sculpt/garments/leathershawl.mjs) on the low-poly bodies, looked over against its references
// (lineup-shawl.png, enchanted-glow-ref.png, registered by tools/sculpt/lowlshawlcams.json) and in the rig's poses:
//
//   node tools/sculpt/lowlshawlshot.mjs --ref <dir with the references> --out <dir> [--only sheet,poses,metrics,walk]
//     [--name <file prefix>] [--under <garment asset json, per body: {who}>]
//     <name>-sheet-<who>.png: each registered view, the reference's crop beside the model plain and enchanted in the same
//       camera (her back and side: his reference, as the glow reference draws only him);
//     <name>-poses.png: rest, arms out, arms forward, overhead, head turned, nod, the game's walk and idle, the swing's
//       guard, top and impact, with the triangles crossing the body's;
//     <name>-metrics.json: the checks at rest and in every pose (the idle over its whole loop: 24 phases; the walk 16);
//     <name>-walk.gif: the game's walk, both bodies, front, three-quarter and side, plain then enchanted.
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { buildRig, posed, skin, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, checks, bonesWith } from './lowgarment.mjs';
import { buildLeatherShawl, leatherShawlWeights, MATS, LOOKS } from './garments/leathershawl.mjs';
import { shoot, closeBrowser, lookColour } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowlshawl')), REF = resolve(opt('ref', '.')), name = opt('name', 'shawl');
const only = opt('only', 'sheet,poses,metrics,walk').split(',');
mkdirSync(out, { recursive: true });
const DIR = new URL('.', import.meta.url).pathname;
const CAMS = JSON.parse(readFileSync(join(DIR, 'lowlshawlcams.json'), 'utf8'));
const SIZE = { lineup: [1448, 1086], glow: [1214, 1295] };

const SKIN = [0.68, 0.49, 0.41];
const colOf = (look, m) => lookColour(LOOKS[look][m] ?? { c: MATS[m] });
const bodyMesh = (rig, P, hide = new Set()) => ({ P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.filter((t) => !hide.has(t.poly)).map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) });
const garMesh = (G, P, look = 'plain') => ({ P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => colOf(look, p.mat)) });
/** A garment asset (lowgarment.mjs garmentAsset, as written beside the body) as a mesh in its rest pose, its own colours. */
const assetMesh = (A) => { const P = []; for (let i = 0; i < A.verts.length; i += 3) P.push(A.verts.slice(i, i + 3)); const tris = []; for (let t = 0; t < A.tris.length; t += 4) tris.push(A.tris.slice(t, t + 4)); return { P, polys: A.polys.map(([v]) => v), tris, col: A.polys.map(([, m]) => A.colours[m]) }; };

const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who), underFile = opt('under', null);
  const under = underFile ? JSON.parse(readFileSync(underFile.replace('{who}', who), 'utf8')) : null;
  const uMesh = under ? assetMesh(under) : null;
  const G = buildLeatherShawl(rig, undefined, { under: uMesh ? [{ verts: uMesh.P, tris: uMesh.tris.map((t) => ({ v: t.slice(0, 3) })) }] : [] });
  G.vw = leatherShawlWeights(rig, G);
  M[who] = { rig, G, under, hide: new Set(under?.hides ?? []) };
  console.log(who, 'rest', JSON.stringify(checks(G, G.verts, rig.B, rig.B.verts)));
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
/* ---- the game's clips (src/sculpt/anim: idle, walk, the two-handed swing), bundled for node (as lowmantleshot.mjs) --- */
const ROOT = new URL('../..', import.meta.url).pathname;
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const modFile = join(out, `.anim-${process.pid}.mjs`);
writeFileSync(modFile, (await build({ stdin: { contents: `export { CLIPS } from './src/sculpt/anim'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text);
const AN = await import(pathToFileURL(modFile).href);
rmSync(modFile);
/** A clip's pose at time t as the rig takes it (the clip player's local turns on the control bones). */
function clipPose(who, clipName, t) {
  const { rig } = M[who], clip = AN.CLIPS[clipName], body = who === 'male' ? 'man' : 'woman', sk = AN.lowSkeleton(body);
  const r = AN.clipLocal(sk, clip, t, clip.grip ? AN.lowHeld(body) : undefined), pose = {};
  r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; });
  return pose;
}
const keyT = (clipName, key) => AN.CLIPS[clipName].poses.find((p) => p.name === key).t;
function dress(who, pose) {
  const { rig, G } = M[who];
  const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G);
  const so = rig.B.names.map((n, i) => (/^so\d\.[LR]$/.test(n) ? i : -1)).filter((i) => i >= 0);
  const dy = rig.J.floor - Math.min(...so.map((i) => PB[i][1]));
  const sh = (P) => P.map((p) => [p[0], p[1] + dy, p[2]]);
  return { PB: sh(PB), PG: sh(PG), dy };
}
const scene = (who, d, look = 'plain') => [bodyMesh(M[who].rig, d.PB, M[who].hide), garMesh(M[who].G, d.PG, look), ...(M[who].under && !d.posed ? [assetMesh(M[who].under)].map((m) => ({ ...m, P: m.P.map((p) => [p[0], p[1] + d.dy, p[2]]) })) : [])];

/* ---- the sheet: each registered view, the reference beside the model plain and enchanted --------------------------- */
if (only.includes('sheet')) for (const who of ['male', 'female']) {
  const k = 2, cells = [], imgs = [], texts = [];
  const views = [...Object.entries(CAMS[who]), ...(who === 'female' ? ['gback', 'gside'].map((v) => [v, { ...CAMS.male[v], stand: true }]) : [])].filter(([v]) => v !== 'about');
  let x = 0;
  const d = dress(who, {}), lift = -d.dy;
  const rest = { PB: d.PB.map((p) => [p[0], p[1] + lift, p[2]]), PG: d.PG.map((p) => [p[0], p[1] + lift, p[2]]), dy: 0 };
  for (const [v, c0] of views) {
    let c = c0;
    // (her stand-in views: his reference's camera, s scaled by her height to his, the head's top kept)
    if (c.stand) { const hm = 13.88, hf = 14.15 * 0.85; c = { ...c, s: c.s * hm / hf * 0.85 }; }
    const [bx, by, bw, bh] = c.box, W = bw * k, H = bh * k, a = c.yaw * Math.PI / 180;
    const ref = join(REF, CAMS.refs[c.ref]), [SW, SH] = SIZE[c.ref];
    imgs.push({ src: ref, size: [SW, SH], crop: [bx, by, bw, bh], box: [x, 30, W, H] });
    const dd = (bx + bw / 2 - c.cx) / c.s, piv = [Math.cos(a) * dd, (c.cy - (by + bh / 2)) / c.s, Math.sin(a) * dd];
    const cam = { yaw: -c.yaw, pitch: 0, s: c.s * k, c: piv };
    // (the view's 2D correction ax: the meshes scaled along the screen's horizontal about the camera's axis)
    const h = [Math.cos(a), 0, Math.sin(a)], ax = c.ax ?? 1, S = (P) => P.map((p) => { const t = (ax - 1) * (p[0] * h[0] + p[2] * h[2]); return [p[0] + t * h[0], p[1], p[2] + t * h[2]]; });
    const view = { PB: S(rest.PB), PG: S(rest.PG), dy: 0 };
    ['plain', 'enchanted'].forEach((look, j) => cells.push({ meshes: scene(who, view, look), cam, box: [x, 30 + (j + 1) * (H + 6), W, H], label: j ? 'enchanted' : 'plain' }));
    texts.push({ css: `left:${x + 4}px;top:34px`, html: `${v}${c.stand ? ' (his reference)' : ''}${(c.ax ?? 1) !== 1 ? ` · ax ${c.ax}` : ''}` });
    x += W + 8;
  }
  texts.push({ css: 'left:8px;top:4px', html: `Leather shawl on the low-poly ${who}: the reference, the model plain, the model enchanted (${M[who].G.tris.length} triangles)` });
  await shoot(x, 30 + 3 * (Math.max(...views.map(([, c]) => c.box[3])) * k + 6), cells, join(out, `${name}-sheet-${who}.png`), { texts, imgs });
  console.log('wrote', join(out, `${name}-sheet-${who}.png`));
}

/* ---- poses and metrics ---------------------------------------------------------------------------------------------- */
async function poseList(who) {
  const { rig } = M[who], walk = AN.CLIPS.walk, idle = AN.CLIPS.idle;
  return [{ id: 'rest', label: 'Rest', pose: {} }, ...testPoses(rig),
    ...Array.from({ length: 16 }, (_, k) => ({ id: `walk-${k}`, label: `Walk ${k + 1}/16`, pose: clipPose(who, 'walk', (k / 16) * walk.length) })),
    ...Array.from({ length: 24 }, (_, k) => ({ id: `idle-${k}`, label: `Idle ${k + 1}/24`, pose: clipPose(who, 'idle', (k / 24) * idle.length) })),
    ...[['rest', 'guard'], ['top', 'top'], ['impact', 'impact']].map(([n, l]) => ({ id: `swing-${l}`, label: `Swing ${l}`, pose: clipPose(who, 'swing', keyT('swing', n) + 1e-4) }))];
}
if (only.includes('metrics') || only.includes('poses')) {
  for (const who of ['male', 'female']) {
    const { rig, G } = M[who];
    metrics[who] = {};
    for (const e of (await poseList(who)).filter((e) => !process.env.POSES || new RegExp(process.env.POSES).test(e.id))) { const d = dress(who, e.pose); const c = checks(G, d.PG, rig.B, d.PB); metrics[who][e.id] = { self: c.self, body: c.body, bodyParts: c.bodyParts }; }
    const sum = (re) => Object.entries(metrics[who]).filter(([k]) => re.test(k)).reduce((s, [, v]) => s + v.body, 0);
    if (process.env.POSES) { console.log(who, 'idle', sum(/^idle/), 'walk', sum(/^walk/), JSON.stringify(Object.fromEntries(Object.entries(metrics[who]).filter(([, v]) => v.body).map(([k, v]) => [k, v.bodyParts])))); continue; }
    metrics[who].summary = { idle: sum(/^idle/), walk: sum(/^walk/), swing: sum(/^swing/), tests: Object.fromEntries(testPoses(rig).map((e) => [e.id, metrics[who][e.id].body])) };
    metrics[who].bones = { body: rig.bones.length, garment: G.bones.length, total: bonesWith(rig, G).length };
    console.log(who, JSON.stringify(metrics[who].summary));
  }
  writeFileSync(join(out, `${name}-metrics.json`), JSON.stringify(metrics, null, 1));
}
if (only.includes('poses')) {
  const cells = [], cw = 260, ch = 380;
  let r = 0;
  for (const who of ['male', 'female']) {
    const list = (await poseList(who)).filter((e) => !/^(walk|idle)-/.test(e.id) || e.id === 'walk-4' || e.id === 'walk-12' || e.id === 'idle-6');
    list.forEach((e, k) => {
      const d = dress(who, e.pose), m = metrics[who][e.id];
      cells.push({ meshes: scene(who, { ...d, posed: true }), cam: { yaw: k % 2 ? 35 : -20, pitch: 6, s: 50, c: [0, -2 + d.dy, 0] }, box: [(k % 6) * cw, 34 + (r + Math.floor(k / 6)) * ch, cw, ch], label: `${who} ${e.label}: crossings ${m.body}` });
    });
    r += Math.ceil(list.length / 6);
  }
  await shoot(6 * cw, 34 + r * ch, cells, join(out, `${name}-poses.png`), { texts: [{ css: 'left:10px;top:6px', html: 'Leather shawl in poses: the shawl\'s triangles crossing the body\'s' }] });
}

/* ---- worn with its neighbours: the chest under it, the hat over it (assets written beside each body, read-only) ---- */
// --chest <file with {who}> --hat <file with {who}>: the shawl's triangles crossing each in the poses (the idle's whole
// loop, the walk, the test poses, the swing), and the set worn together drawn front, three-quarter, side and back, plain
// and enchanted, at rest and with the head turned.
if (only.includes('neighbours')) {
  const { crossPairs, trisOf: trisOfG } = await import('./lowgarment.mjs');
  const load = (file, who) => { const A = JSON.parse(readFileSync(file.replace('{who}', who), 'utf8')); const m = assetMesh(A); return { A, m, G: { verts: m.P, vw: Array.from({ length: m.P.length }, (_, i) => { const w = A.weights[i], o = []; for (let k = 0; k < w.length; k += 2) o.push([w[k], w[k + 1]]); return o; }) }, T: m.tris.map((t) => ({ v: t.slice(0, 3) })) }; };
  const report = {}, cells = [];
  for (const who of ['male', 'female']) {
    const { rig, G } = M[who], N = { chest: load(opt('chest'), who), hat: load(opt('hat'), who) }, hide = new Set(N.chest.A.hides ?? []);
    const TG = trisOfG(G);
    report[who] = {};
    for (const e of await poseList(who)) {
      const f = posed(rig, e.pose), PG = skinGarment(rig, f, G), r = {};
      for (const [k, n] of Object.entries(N)) { const PN = skinGarment(rig, f, n.G, n.G.vw); r[k] = crossPairs(PG, TG, PN, n.T).length; }
      report[who][e.id] = r;
    }
    const sum = (re, k) => Object.entries(report[who]).filter(([id]) => re.test(id)).reduce((a, [, v]) => a + v[k], 0);
    report[who].summary = Object.fromEntries(['chest', 'hat'].map((k) => [k, { rest: report[who].rest[k], idle: sum(/^idle/, k), walk: sum(/^walk/, k), swing: sum(/^swing/, k), tests: Object.fromEntries(['tpose', 'forward', 'overhead', 'headturn', 'nod'].map((id) => [id, report[who][id][k]])) }]));
    console.log(who, JSON.stringify(report[who].summary));
    // the set worn together: rest and head turned, front, three-quarter, side, back; plain and enchanted
    const neigh = (P, look) => Object.values(N).map((n) => ({ ...n.m, P, col: n.A.polys.map(([, m]) => lookColour((look === 'enchanted' ? n.A.enchanted : n.A.plain)?.[m] ?? { c: n.A.colours[m] })) }));
    const row = cells.length ? Math.max(...cells.map((c) => c.row)) + 1 : 0;
    [['rest', {}], ['headturn', testPoses(rig).find((e) => e.id === 'headturn').pose]].forEach(([id, pose], pi) => ['plain', 'enchanted'].forEach((look, li) => [0, -40, -90, 180].forEach((yaw, vi) => {
      const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G), mesh = [bodyMesh(rig, PB, new Set([...hide])), garMesh(G, PG, look), ...Object.values(N).map((n) => { const P = skinGarment(rig, f, n.G, n.G.vw); return { ...n.m, P, col: n.A.polys.map(([, m]) => lookColour(((look === 'enchanted' ? n.A.enchanted : n.A.plain) ?? [])[m] ?? { c: n.A.colours[m] })) }; })];
      const k = (pi * 2 + li) * 4 + vi;
      cells.push({ row: row + Math.floor(k / 8), meshes: mesh, cam: { yaw, pitch: 4, s: 70, c: [0, -1.3, 0] }, box: [(k % 8) * 240, 34 + (row + Math.floor(k / 8)) * 330, 240, 330], label: k % 4 ? '' : `${who} ${id} ${look}` });
    })));
    void neigh;
  }
  writeFileSync(join(out, `${name}-neighbours.json`), JSON.stringify(report, null, 1));
  const rows = Math.max(...cells.map((c) => c.row)) + 1;
  await shoot(8 * 240, 34 + rows * 330, cells, join(out, `${name}-neighbours.png`), { texts: [{ css: 'left:10px;top:6px', html: 'Leather shawl worn over the leather chest and under the leather hat: rest and head turned, plain and enchanted' }] });
}

/* ---- the walk GIF ---------------------------------------------------------------------------------------------------- */
if (only.includes('walk')) {
  const frames = join(out, 'walk-frames'), F = 12, cw = 220, ch = 420;
  mkdirSync(frames, { recursive: true });
  for (let f = 0; f < 2 * F; f++) {
    const cells = [], look = f < F ? 'plain' : 'enchanted';
    for (const [j, yaw] of [[0, 0], [1, -40], [2, -90]]) for (const [i, who] of [[0, 'male'], [1, 'female']]) {
      const d = dress(who, clipPose(who, 'walk', ((f % F) / F) * AN.CLIPS.walk.length)), sc = who === 'female' ? 0.85 : 1;
      const S = (P) => P.map((p) => [p[0] * sc, (p[1] - M[who].rig.J.floor) * sc, p[2] * sc]);
      cells.push({ meshes: [bodyMesh(M[who].rig, S(d.PB)), garMesh(M[who].G, S(d.PG), look)], cam: { yaw, pitch: 6, s: 26, c: [0, 7.4, 0] }, box: [(j * 2 + i) * cw, 0, cw, ch], label: i + j ? '' : look });
    }
    await shoot(cw * 6, ch, cells, join(frames, `f${String(f).padStart(2, '0')}.png`));
  }
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=90, loop=0)
`, frames, join(out, `${name}-walk.gif`)]);
  rmSync(frames, { recursive: true, force: true });
  console.log('wrote', join(out, `${name}-walk.gif`));
}
await closeBrowser();
