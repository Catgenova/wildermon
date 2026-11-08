// The plate set's fur mantle (tools/sculpt/garments/mantle.mjs) on the low-poly bodies, looked over against its sheet and
// in the rig's poses:
//
//   node tools/sculpt/lowmantleshot.mjs --out <dir> [--only sheet,wire,poses,metrics] [--sheet <mantle sheet png>]
//        [--tag <name>] [--tunic] [--room]
//     mantle-sheet<tag>.png: the sheet's five worn views (front, three-quarter, side, back, rear three-quarter) of each
//       body beside the model's at the sheet's framing, and the shoulders close up below;
//     mantle-wire<tag>.png: the close-ups with every polygon's outline, the triangle counts by part;
//     mantle-layers<tag>.png: each layer alone (main, mid2, mid1, the collar with the ring and the clasps) from the back
//       and the side, then stacked, beside the sheet's back and side views;
//     mantle-looks<tag>.png: plain and enchanted side by side (the clasps' cores), front and three-quarter, both bodies;
//     mantle-poses<tag>.png: rest, arms out, forward and overhead, the game's walk and idle, each with the mantle's
//       triangles crossing the body's and its own;
//     mantle-metrics.json: the checks at rest and in every pose, each body.
//   --tunic: worn over the first outfit's tunic (garments/outfit1.mjs), fitted over it, the tunic drawn;
//   --plate: the torso and the arms drawn in the plate set's plate colour (the fur beside it).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { buildRig, posed, skin, fromGame, gameRig, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, checks, crossPairs } from './lowgarment.mjs';
import { buildMantle, mantleWeights, chestOf, MATS, LOOKS as MANTLE_LOOKS, DESIGN } from './garments/mantle.mjs';
import { shoot, closeBrowser, lookColour } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowmantle'));
const only = opt('only', 'sheet,wire,metrics').split(',');
const tag = opt('tag', '');
const SHEET = resolve(opt('sheet', '/tmp/claude-0/-home-user-Wurm/781c435a-4202-5724-9056-b83f4c44c414/scratchpad/plate/mantle/mantle-sheet.png'));
const over = JSON.parse(opt('design', '{}'));
mkdirSync(out, { recursive: true });

const SKIN = [0.68, 0.49, 0.41];
const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who);
  let under = [], tunic = null;
  if (flag('tunic')) { const { buildOutfit } = await import('./garments/outfit1.mjs'); const O = buildOutfit(rig); tunic = O.tunic; under = [O.tunic]; tunic.hides = O.hides; }
  const G = buildMantle(rig, { ...DESIGN[who], ...over }, { under });
  G.vw = mantleWeights(rig, G);
  M[who] = { rig, G, tunic, chest: chestOf(who) };
}
// (--plate: the torso and the arms in the plate set's plate colour, to see the fur beside it)
const PLATE = [0.7, 0.58, 0.52], plated = new Set(['torso', 'joint', 'arm', 'pelvis']);
const bodyMesh = (rig, P, hidden = new Set()) => ({ who: rig.who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.filter((t) => !hidden.has(t.poly)).map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? (flag('plate') && plated.has(rig.B.part[p.v[0]]) ? PLATE : SKIN) : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) });
// (the mantle in a look, plain or enchanted: its materials' colours, the unlit ones as lowgarmentshot.mjs draws them)
const colourIn = (mats, look) => (n) => { const m = mats === MATS ? MANTLE_LOOKS[look]?.[n] : null; return m ? lookColour(m) : mats[n]; };
const garMesh = (rig, G, P, mats, edges = false, parts = null, look = 'plain') => ({ who: rig.who, P, polys: G.polys.map((p) => p.v), tris: G.tris.filter((t) => !parts || parts.includes(G.polys[t.poly].part)).map((t) => [...t.v, t.poly]), col: G.polys.map((p) => colourIn(mats, look)(p.mat)), edges, edgec: [0.25, 0.16, 0.12] });

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
/* ---- the game's clips (src/sculpt/anim: idle, walk, the two-handed swing), bundled for node ------------------------- */
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
const keyT = (name, key) => AN.CLIPS[name].poses.find((p) => p.name === key).t;
/** The poses checked: the test poses, the walk (8 keys), the idle's whole loop (12), the swing's guard, top and impact. */
function allPoses(who) {
  const { rig } = M[who], walk = AN.CLIPS.walk, idle = AN.CLIPS.idle;
  return [{ id: 'rest', label: 'Rest', pose: {} }, ...testPoses(rig),
    ...Array.from({ length: 8 }, (_, k) => ({ id: `walk-${k}`, label: `Walk ${k + 1}/8`, pose: clipPose(who, 'walk', (k / 8) * walk.length) })),
    ...Array.from({ length: 12 }, (_, k) => ({ id: `idle-${k}`, label: `Idle ${k + 1}/12`, pose: clipPose(who, 'idle', (k / 12) * idle.length) })),
    ...[['rest', 'guard'], ['top', 'top'], ['impact', 'impact']].map(([n, l]) => ({ id: `swing-${l}`, label: `Swing ${l}`, pose: clipPose(who, 'swing', keyT('swing', n) + 1e-4) }))];
}
function dress(who, pose) {
  const { rig, G, tunic } = M[who];
  const f = posed(rig, pose);
  const { chest } = M[who];
  return { PB: skin(rig, f), PG: skinGarment(rig, f, G), PT: tunic ? skinGarment(rig, f, tunic) : null, PC: chest ? skinGarment(rig, f, chest, chest.vw) : null };
}
const scene = (who, d, o = {}) => {
  const { rig, G, tunic } = M[who];
  const { chest } = M[who];
  const m = [bodyMesh(rig, d.PB, new Set([...(tunic ? tunic.hides.tunic : []), ...(chest ? chest.hides : [])]))];
  // (the plate chest piece, where it is here: its own look's colours, the metals as the shots draw metal)
  if (chest) m.push({ who: rig.who, P: d.PC, polys: chest.polys.map((p) => p.v), tris: chest.tris.map((t) => [...t.v, t.poly]), col: chest.polys.map((p) => lookColour(chest.plain[chest.mats.indexOf(p.mat)])) });
  if (tunic) m.push(garMesh(rig, tunic, d.PT, { fabric: [0.72, 0.62, 0.56], trim: [0.603, 0.421, 0.294], inner: [0.51, 0.356, 0.268], pattern: [0.72, 0.62, 0.56] }));
  m.push(garMesh(rig, G, d.PG, MATS, o.edges, null, o.look ?? 'plain'));
  return m;
};
function measure(who, d) {
  const { rig, G, tunic } = M[who];
  const c = checks(G, d.PG, rig.B, d.PB);
  const r = { tris: c.tris, body: c.body, self: c.self, bodyParts: c.bodyParts, selfParts: c.selfParts, open: c.open, nonManifold: c.nonManifold, offPlane: c.offPlane };
  if (tunic) r.tunic = crossPairs(d.PG, G.tris, d.PT, tunic.tris).length;
  if (d.PC) r.chest = crossPairs(d.PG, G.tris, d.PC, M[who].chest.tris).length;
  // (DIAG=1: where the mantle crosses itself, each pair's parts, clumps and azimuth at rest)
  if (process.env.DIAG && r.self) console.log(who, crossPairs(d.PG, G.tris).slice(0, 8).map(([a, b]) => { const pa = G.polys[G.tris[a].poly], pb = G.polys[G.tris[b].poly], v = G.verts[G.tris[a].v[0]]; return `${pa.part}#${pa.clump}/${pa.mat}×${pb.part}#${pb.clump}/${pb.mat}@${Math.round(Math.atan2(v[0], v[2] + 0.12) * 180 / Math.PI)},${v[1].toFixed(2)}`; }).join(' '));
  return r;
}

/* ---- the sheet: five views beside the sheet's ------------------------------------------------------------------------- */
// the sheet's worn views (mantle-sheet.png, 1536 x 1024): his row at y 95..340, hers at 440..660; in the sheet's order
const VIEWS = [[0, 'Front (0°)'], [-45, 'Three-quarter (45°)'], [-90, 'Side (90°)'], [180, 'Back (180°)'], [-135, 'Rear three-quarter (135°)']];
const CROPS = { male: [[20, 95, 195, 245], [215, 95, 185, 245], [398, 95, 122, 245], [515, 95, 150, 245], [660, 95, 155, 245]], female: [[20, 438, 195, 225], [215, 438, 185, 225], [395, 438, 122, 225], [515, 438, 150, 225], [655, 438, 160, 225]] };
async function sheet(file, edges) {
  const cw = 230, ch = 290, cc = 270, top = 34, cells = [], imgs = [], texts = [];
  let y = top;
  for (const who of ['male', 'female']) {
    const d = dress(who, {}), sc = who === 'male' ? 1 : 0.85;
    VIEWS.forEach(([yaw, lab], i) => {
      if (!edges) imgs.push({ src: SHEET, size: [1536, 1024], crop: CROPS[who][i], box: [i * cw, y, cw, ch] });
      // the sheet's figures are framed by their shoulders (its heads are larger than the bodies'): his deltoids 4.1 units, 177 px
      if (!edges) cells.push({ meshes: scene(who, d), cam: { yaw, pitch: 0, s: 34 / sc, c: [0, -2.0, 0] }, box: [i * cw, y + ch, cw, ch], label: `${who} ${lab}` });
      cells.push({ meshes: scene(who, d, { edges }), cam: { yaw, pitch: edges ? 12 : 6, s: 50 / sc, c: [0, -1.0, 0] }, box: [i * cw, y + (edges ? 0 : 2 * ch), cw, cc], label: edges ? `${who} ${lab}` : 'close' });
    });
    const G = M[who].G, parts = {};
    for (const t of G.tris) { const p = G.polys[t.poly].part; parts[p] = (parts[p] ?? 0) + 1; }
    texts.push({ cls: 'lab', css: `left:${5 * cw + 10}px;top:${y + 10}px;white-space:normal;width:200px`, html: `<b>${who}</b><br>${G.tris.length} triangles<br>` + Object.entries(parts).map(([k, v]) => `${k} ${v}`).join('<br>') + (edges ? '' : '<br><br>rows: the sheet, the model at the sheet\'s framing, close up') });
    y += edges ? cc : 2 * ch + cc;
  }
  if (!edges) imgs.push({ src: SHEET, size: [1536, 1024], crop: [828, 92, 400, 345], box: [5 * cw, y - 330, 220, 300] });
  texts.push({ css: 'left:10px;top:6px', html: opt('title', `The fur mantle on both low-poly bodies${flag('tunic') ? ', over the tunic' : ''}: ${edges ? 'the polygons' : 'the sheet\'s five views above the model\'s'} ${tag}`) });
  await shoot(5 * cw + 220, y + 6, cells, file, { texts, imgs });
}
if (only.includes('sheet')) await sheet(join(out, `mantle-sheet${tag}.png`), false);
if (only.includes('wire')) await sheet(join(out, `mantle-wire${tag}.png`), true);

/* ---- the layers apart: each alone, back and side, and stacked, beside the sheet's back and side ------------------------ */
if (only.includes('layers')) {
  const cw = 168, ch = 250, top = 34, cells = [], imgs = [], texts = [];
  const LAYERS = [['main', ['main']], ['mid2', ['mid2']], ['mid1', ['mid1']], ['collar, ring, clasps', ['collar', 'ring', 'clasp_l', 'clasp_r']], ['stacked', null]];
  ['male', 'female'].forEach((who, r) => {
    const { rig, G } = M[who], d = dress(who, {}), sc = who === 'male' ? 1 : 0.85, y = top + r * (ch + 20);
    imgs.push({ src: SHEET, size: [1536, 1024], crop: CROPS[who][3], box: [0, y, cw, ch] }, { src: SHEET, size: [1536, 1024], crop: CROPS[who][2], box: [cw, y, cw, ch] });
    LAYERS.forEach(([lab, parts], i) => [[180, 'back'], [-90, 'side']].forEach(([yaw, v], j) => {
      cells.push({ meshes: [bodyMesh(rig, d.PB), garMesh(rig, G, d.PG, MATS, false, parts)], cam: { yaw, pitch: 0, s: 30 / sc, c: [0, -2.2, 0] }, box: [(2 + 2 * i + j) * cw, y, cw, ch], label: `${lab} ${v}` });
    }));
    texts.push({ cls: 'lab', css: `left:6px;top:${y + ch + 1}px`, html: `${who}: the sheet's back and side` });
  });
  texts.push({ css: 'left:10px;top:6px', html: `The fur mantle's layers apart ${tag}: each alone from the back and the side, then stacked, beside the sheet's` });
  await shoot(12 * cw, top + 2 * (ch + 20), cells, join(out, `mantle-layers${tag}.png`), { texts, imgs });
}

/* ---- plain and enchanted: the clasps close up, both bodies --------------------------------------------------------------- */
if (only.includes('looks')) {
  const cw = 240, ch = 230, top = 34, cells = [];
  ['male', 'female'].forEach((who, r) => {
    const d = dress(who, {}), sc = who === 'male' ? 1 : 0.85;
    [[0, 'front'], [-40, 'three-quarter']].forEach(([yaw, v], j) => ['plain', 'enchanted'].forEach((look, i) => {
      cells.push({ meshes: scene(who, d, { look }), cam: { yaw, pitch: 6, s: 64 / sc, c: [0, -1.0, 0] }, box: [(2 * j + i) * cw, top + r * ch, cw, ch], label: `${who} ${v}, ${look}` });
    }));
  });
  await shoot(4 * cw, top + 2 * ch, cells, join(out, `mantle-looks${tag}.png`), { texts: [{ css: 'left:10px;top:6px', html: `The fur mantle plain and enchanted ${tag}: the clasps' cores a gem, then glowing` }] });
}

/* ---- poses ---------------------------------------------------------------------------------------------------------- */
if (only.includes('poses')) {
  const cw = 230, ch = 270, cells = [];
  let row = 0;
  for (const who of ['male', 'female']) {
    const list = allPoses(who).filter((e) => ['rest', 'tpose', 'forward', 'overhead', 'walk-2', 'walk-6', 'idle-4', 'swing-guard', 'swing-top', 'swing-impact'].includes(e.id));
    for (const [yi, yaw] of [[0, -30], [1, -150]]) {
      list.forEach((e, k) => {
        const d = dress(who, e.pose), m = measure(who, d);
        cells.push({ meshes: scene(who, d), cam: { yaw, pitch: 8, s: 40, c: [0, /overhead|swing/.test(e.id) ? -0.6 : -1.2, 0] }, box: [k * cw, 34 + row * ch, cw, ch], label: `${who} ${e.label} · body ${m.body} self ${m.self}${m.tunic != null ? ' tunic ' + m.tunic : ''}${m.chest != null ? ' chest ' + m.chest : ''}` });
      });
      row++;
    }
  }
  await shoot(10 * cw, 34 + row * ch, cells, join(out, `mantle-poses${tag}.png`), { texts: [{ css: 'left:10px;top:6px', html: `The fur mantle in poses ${tag}: the numbers, its triangles crossing the body's and its own` }] });
}

/* ---- metrics -------------------------------------------------------------------------------------------------------- */
if (only.includes('metrics')) {
  const metrics = {};
  for (const who of ['male', 'female']) {
    const list = allPoses(who);
    metrics[who] = {};
    for (const e of list) metrics[who][e.id] = measure(who, dress(who, e.pose));
    const r = metrics[who].rest;
    console.log(who, `tris ${r.tris} open ${r.open} nonManifold ${r.nonManifold} offPlane ${r.offPlane}`, Object.entries(metrics[who]).map(([k, v]) => `${k}:${v.body}/${v.self}${v.tunic != null ? '/t' + v.tunic : ''}${v.chest != null ? '/c' + v.chest : ''}`).join(' '));
  }
  writeFileSync(join(out, `mantle-metrics${tag}.json`), JSON.stringify(metrics, null, 1));
}
await closeBrowser();
