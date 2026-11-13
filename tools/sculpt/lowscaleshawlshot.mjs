// The scale set's wing mantle (tools/sculpt/garments/scaleshawl.mjs) on the low-poly bodies over the scale cuirass,
// looked over close and in the rig's poses, with the numbers:
//
//   node tools/sculpt/lowscaleshawlshot.mjs --out <dir> [--only alone,views,wire,looks,poses,metrics] [--tag <name>]
//        [--helm] [--design '{...}']
//     <tag>-alone.png: the wings alone, front, three-quarter, side, back and from above, both bodies;
//     <tag>-views.png: worn over the cuirass, front, three-quarter, side, rear three-quarter and back, both bodies
//       (--helm: the scale helm on);
//     <tag>-wire.png: the same with every polygon's outline, the triangles by part;
//     <tag>-looks.png: plain and enchanted (the joints and the claws), front and three-quarter;
//     <tag>-poses-<who>-<front|back>.png: rest, arms out, forward and overhead, and frames of the game's clips (the overhead swing, the
//       one-handed fight, the bow's draw, the work at the ground), each with its crossings;
//     <tag>-metrics.json: the crossings at rest and through every clip, each body: the wings' triangles through the
//       body's (as drawn: what the cuirass and the helm hide left out), the cuirass's, the helm's and their own.
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { buildRig, posed, skin, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, crossPairs } from './lowgarment.mjs';
import { buildScaleShawl, scaleShawlWeights, scaleChestOf, MATS, LOOKS, DESIGN } from './garments/scaleshawl.mjs';
import { shoot, closeBrowser, lookColour } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowscaleshawl'));
const only = opt('only', 'alone,views,looks,metrics').split(',');
const tag = opt('tag', 'wings');
const over = JSON.parse(opt('design', '{}'));
mkdirSync(out, { recursive: true });

const SKIN = [0.68, 0.49, 0.41];
/** A garment asset (src/sculpt/assets/<file>) as a mesh with its weights. */
function assetMesh(file) {
  const A = JSON.parse(readFileSync(new URL(`../../src/sculpt/assets/${file}`, import.meta.url), 'utf8')), verts = [], tris = [];
  for (let i = 0; i < A.verts.length; i += 3) verts.push(A.verts.slice(i, i + 3));
  for (let i = 0; i < A.tris.length; i += 4) tris.push({ v: A.tris.slice(i, i + 3), poly: A.tris[i + 3] });
  const polys = A.polys.map(([v, m]) => ({ v, mat: A.mats[m] })), vw = A.weights.map((w) => { const o = []; for (let k = 0; k < w.length; k += 2) o.push([w[k], w[k + 1]]); return o; });
  return { verts, tris, polys, vw, hides: A.hides ?? [], plain: A.plain, enchanted: A.enchanted, mats: A.mats };
}
const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who), chest = scaleChestOf(who);
  const G = buildScaleShawl(rig, { ...DESIGN[who], ...over }, { chest });
  G.vw = scaleShawlWeights(rig, G);
  const helm = flag('helm') ? assetMesh(`lowscalehelm-${who}.json`) : null;
  M[who] = { rig, G, chest, helm };
  console.log(who, `${G.tris.length} triangles, cleared ${JSON.stringify(G.cleared)}`);
}
const bodyMesh = (rig, P, hidden = new Set()) => ({ who: rig.who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.filter((t) => !hidden.has(t.poly)).map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) });
const assetDraw = (rig, A, P, look = 'plain') => ({ who: rig.who, P, polys: A.polys.map((p) => p.v), tris: A.tris.map((t) => [...t.v, t.poly]), col: A.polys.map((p) => lookColour(A[look][A.mats.indexOf(p.mat)])) });
const wingDraw = (rig, G, P, look = 'plain', edges = false) => ({ who: rig.who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => lookColour(LOOKS[look][p.mat] ?? { c: MATS[p.mat], kind: 0 })), edges, edgec: [0.12, 0.1, 0.1] });

/* ---- poses ---------------------------------------------------------------------------------------------------------- */
function testPoses(rig) {
  const W = (bone, axis, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const symW = (p, bone, axis, deg) => { p[`${bone}_l`] = mm(W(`${bone}_l`, axis, deg), p[`${bone}_l`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); p[`${bone}_r`] = mm(W(`${bone}_r`, [-axis[0], axis[1], axis[2]], -deg), p[`${bone}_r`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); return p; };
  const P = [
    { id: 'tpose', label: 'Arms out', pose: symW(symW({}, 'upperarm', Z, 74), 'lowerarm', Z, 10) },
    { id: 'forward', label: 'Arms forward', pose: symW(symW(symW({}, 'clavicle', Y, -14), 'upperarm', X, -84), 'upperarm', Y, -2) },
    { id: 'overhead', label: 'Arms overhead', pose: (() => { const p = symW(symW({}, 'clavicle', Z, 22), 'upperarm', Z, 140); return symW(p, 'lowerarm', Z, 8); })() },
  ];
  if (rig.who === 'female') for (const e of P) e.pose = armsOut(rig, e.pose);
  return P;
}
const ROOT = new URL('../..', import.meta.url).pathname;
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const modFile = join(out, `.anim-${process.pid}.mjs`);
writeFileSync(modFile, (await build({ stdin: { contents: `export { CLIPS } from './src/sculpt/anim'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text);
const AN = await import(pathToFileURL(modFile).href);
rmSync(modFile);
/** A clip's pose at time t as the rig takes it (the clip player's local turns on the control bones). */
function clipPose(who, name, t) {
  const { rig } = M[who], clip = AN.CLIPS[name], body = who === 'male' ? 'man' : 'woman', sk = AN.lowSkeleton(body);
  const r = AN.clipLocal(sk, clip, t, clip.grip ? AN.lowHeld(body) : undefined), pose = {};
  r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; });
  return pose;
}
const keyT = (name, key) => AN.CLIPS[name].poses?.find((p) => p.name === key)?.t;
/** Every clip checked, sampled through its length: the walk, the idle, the overhead swing, the fight, the shot, the ground. */
const CLIPS = [['walk', 8], ['idle', 12], ['swing', 16], ['fight', 12], ['shoot', 12], ['ground', 12]];
function allPoses(who) {
  const { rig } = M[who];
  return [{ id: 'rest', label: 'Rest', pose: {} }, ...testPoses(rig),
    ...CLIPS.flatMap(([name, n]) => Array.from({ length: n }, (_, k) => ({ id: `${name}-${k}`, label: `${name} ${k + 1}/${n}`, pose: clipPose(who, name, (k / n) * AN.CLIPS[name].length) })))];
}
/** The frames drawn: the test poses and a key frame of each clip. */
function shownPoses(who) {
  const at = (name, key, f) => { const t = keyT(name, key); return t == null ? f * AN.CLIPS[name].length : t + 1e-4; };
  return [{ id: 'rest', label: 'Rest', pose: {} }, ...testPoses(M[who].rig),
    ...[['swing', 'top', 0.5, 'Swing top'], ['swing', 'impact', 0.8, 'Swing impact'], ['fight', null, 0.55, 'Fight blow'], ['fight', null, 0.3, 'Fight raised'], ['shoot', 'full draw', 0.3, 'Bow full draw'], ['ground', 'dig right', 0.2, 'Ground (kneel)']]
      .map(([name, key, f, label]) => ({ id: `${name}-${key ?? f}`, label, pose: clipPose(who, name, key ? at(name, key, f) : f * AN.CLIPS[name].length) }))];
}
function dress(who, pose) {
  const { rig, G, chest, helm } = M[who], f = posed(rig, pose);
  return { PB: skin(rig, f), PG: skinGarment(rig, f, G), PC: skinGarment(rig, f, chest, chest.vw), PH: helm ? skinGarment(rig, f, helm, helm.vw) : null };
}
const scene = (who, d, o = {}) => {
  const { rig, G, chest, helm } = M[who];
  const m = o.alone ? [] : [bodyMesh(rig, d.PB, new Set([...chest.hides, ...(helm ? helm.hides : [])])), assetDraw(rig, chest, d.PC, o.look)];
  if (helm && !o.alone) m.push(assetDraw(rig, helm, d.PH, o.look));
  m.push(wingDraw(rig, G, d.PG, o.look, o.edges));
  return m;
};
function measure(who, d) {
  const { rig, G, chest, helm } = M[who], hid = new Set([...chest.hides, ...(helm ? helm.hides : [])]);
  const BT = rig.B.tris.filter((t) => !hid.has(t.poly));
  // (the wings' own crossings, only where they cannot touch at rest: one wing through the other, a membrane through itself)
  const sideOf = (t) => G.polys[G.tris[t].poly].part.match(/_([lr])/)?.[1];
  const self = crossPairs(d.PG, G.tris).filter(([a, b]) => sideOf(a) !== sideOf(b) || (/^membrane/.test(G.polys[G.tris[a].poly].part) && /^membrane/.test(G.polys[G.tris[b].poly].part))).length;
  const r = { body: crossPairs(d.PG, G.tris, d.PB, BT).length, chest: crossPairs(d.PG, G.tris, d.PC, chest.tris).length, self };
  if (process.env.DIAG) { const c = {}; for (const [a, b] of crossPairs(d.PG, G.tris)) { if (sideOf(a) === sideOf(b) && !(/^membrane/.test(G.polys[G.tris[a].poly].part) && /^membrane/.test(G.polys[G.tris[b].poly].part))) continue; const k = [G.polys[G.tris[a].poly].part, G.polys[G.tris[b].poly].part].sort().join('×'); c[k] = (c[k] ?? 0) + 1; } r.selfWhere = c; }
  if (helm) r.helm = crossPairs(d.PG, G.tris, d.PH, helm.tris).length;
  if (process.env.DIAG && (r.body || r.chest)) {
    const c = {};
    for (const [a, b] of crossPairs(d.PG, G.tris, d.PB, BT)) { const k = `${G.polys[G.tris[a].poly].part}×${rig.B.part[BT[b].v[0]]}`; c[k] = (c[k] ?? 0) + 1; }
    for (const [a, b] of crossPairs(d.PG, G.tris, d.PC, chest.tris)) { const k = `${G.polys[G.tris[a].poly].part}×chest/${chest.polys[chest.tris[b].poly].mat}`; c[k] = (c[k] ?? 0) + 1; }
    r.where = c;
  }
  return r;
}
// (the wings' self crossings at rest are where pieces are laid on one another: counted in each pose as more than at rest)
const REST_SELF = {};

const VIEWS = [[0, 'front'], [-40, 'three-quarter'], [-90, 'side'], [-140, 'rear three-quarter'], [180, 'back']];
if (only.includes('alone')) {
  const cw = 250, ch = 260, cells = [];
  ['male', 'female'].forEach((who, r) => {
    const d = dress(who, {}), sc = who === 'male' ? 1 : 0.88;
    [...VIEWS, [-40, 'from above', 55]].forEach(([yaw, lab, pitch], i) => cells.push({ meshes: scene(who, d, { alone: true }), cam: { yaw, pitch: pitch ?? 8, s: +opt('s', '34') / sc, c: [0, +opt('cy', '-1.8'), 0] }, box: [i * cw, 34 + r * ch, cw, ch], label: `${who} ${lab}` }));
  });
  const parts = Object.fromEntries(['male', 'female'].map((who) => { const G = M[who].G, o = {}; for (const t of G.tris) { const p = G.polys[t.poly].part.replace(/_[lr]\d*$/, '').replace(/\d+$/, ''); o[p] = (o[p] ?? 0) + 1; } return [who, `${G.tris.length} triangles (${Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ')})`]; }));
  await shoot(6 * cw, 34 + 2 * ch, cells, join(out, `${tag}-alone.png`), { texts: [{ css: 'left:10px;top:6px', html: `The wing mantle alone · his ${parts.male} · hers ${parts.female}` }] });
}
for (const [key, edges] of [['views', false], ['wire', true]]) {
  if (!only.includes(key)) continue;
  const cw = 250, ch = 300, cells = [];
  ['male', 'female'].forEach((who, r) => {
    const d = dress(who, {}), sc = who === 'male' ? 1 : 0.88;
    VIEWS.forEach(([yaw, lab], i) => cells.push({ meshes: scene(who, d, { edges }), cam: { yaw, pitch: 8, s: +opt('s', '40') / sc, c: [0, +opt('cy', '-1.9'), 0] }, box: [i * cw, 34 + r * ch, cw, ch], label: `${who} ${lab}` }));
  });
  await shoot(5 * cw, 34 + 2 * ch, cells, join(out, `${tag}-${key}.png`), { texts: [{ css: 'left:10px;top:6px', html: `The wing mantle over the scale cuirass${flag('helm') ? ', the scale helm on' : ''}${edges ? ': its polygons' : ''}` }] });
}
if (only.includes('looks')) {
  const cw = 250, ch = 250, cells = [];
  ['male', 'female'].forEach((who, r) => {
    const d = dress(who, {}), sc = who === 'male' ? 1 : 0.88;
    [[0, 'front'], [-40, 'three-quarter'], [180, 'back']].forEach(([yaw, v], j) => ['plain', 'enchanted'].forEach((look, i) => {
      cells.push({ meshes: scene(who, d, { look }), cam: { yaw, pitch: 8, s: 44 / sc, c: [0, -1.5, 0] }, box: [(2 * j + i) * cw, 34 + r * ch, cw, ch], label: `${who} ${v}, ${look}` });
    }));
  });
  await shoot(6 * cw, 34 + 2 * ch, cells, join(out, `${tag}-looks.png`), { texts: [{ css: 'left:10px;top:6px', html: 'The wing mantle plain and enchanted: the joints and the claw clasp glow' }] });
}
if (only.includes('poses')) {
  // (a sheet a body and a view: the page takes only so many meshes at once)
  const cw = 300, ch = 330;
  for (const who of ['male', 'female']) for (const [yaw, v] of [[-30, 'front'], [-150, 'back']]) {
    const list = shownPoses(who), cells = [];
    REST_SELF[who] ??= measure(who, dress(who, {})).self;
    list.forEach((e, k) => {
      const d = dress(who, e.pose), m = measure(who, d);
      cells.push({ meshes: scene(who, d), cam: { yaw, pitch: 8, s: 30, c: [0, /overhead|Swing|Fight/.test(e.label) ? -1.2 : /kneel/.test(e.label) ? -3.4 : -1.9, 0] }, box: [(k % 5) * cw, 34 + Math.floor(k / 5) * ch, cw, ch], label: `${e.label}<br>body ${m.body} cuirass ${m.chest} self ${m.self}${m.helm != null ? ' helm ' + m.helm : ''}` });
    });
    await shoot(5 * cw, 34 + Math.ceil(list.length / 5) * ch, cells, join(out, `${tag}-poses-${who}-${v}.png`), { texts: [{ css: 'left:10px;top:6px', html: `The wing mantle in poses, ${who}, from the ${v}: its triangles through the body's (as drawn), the cuirass's, its own (one wing through the other, a membrane through itself)${flag('helm') ? ' and the helm\'s' : ''}` }] });
  }
}
if (only.includes('metrics')) {
  const metrics = {};
  for (const who of ['male', 'female']) {
    metrics[who] = {};
    REST_SELF[who] ??= measure(who, dress(who, {})).self;
    for (const e of allPoses(who)) metrics[who][e.id] = measure(who, dress(who, e.pose));
    const sum = {};
    for (const [id, v] of Object.entries(metrics[who])) { const k = id.replace(/-\d+$/, ''); const s = (sum[k] ??= { body: 0, chest: 0, self: 0, helm: 0, worst: 0 }); s.body += v.body; s.chest += v.chest; s.self += v.self; s.helm += v.helm ?? 0; s.worst = Math.max(s.worst, v.body + v.chest + (v.helm ?? 0)); }
    console.log(who, `rest self ${REST_SELF[who]}`, Object.entries(sum).map(([k, s]) => `${k}: body ${s.body} cuirass ${s.chest} self ${s.self}${M[who].helm ? ' helm ' + s.helm : ''} (worst frame ${s.worst})`).join(' | '));
    if (process.env.DIAG) for (const [id, v] of Object.entries(metrics[who])) if (v.where || v.selfWhere) console.log(' ', id, JSON.stringify(v.where ?? {}), JSON.stringify(v.selfWhere ?? {}));
  }
  writeFileSync(join(out, `${tag}-metrics.json`), JSON.stringify(metrics, null, 1));
}
await closeBrowser();
