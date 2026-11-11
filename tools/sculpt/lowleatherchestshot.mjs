// The leather set's chest & arms (tools/sculpt/garments/leatherchest.mjs) on the low-poly bodies, looked over against
// its sheet (tools/sculpt/ref/leather-chest.png) and in the game's clips (src/sculpt/anim: idle, walk, the two-handed swing):
//
//   node tools/sculpt/lowleatherchestshot.mjs --out <dir> [--tag <name>] [--only sheet,wire,poses,full,metrics,walk]
//     leatherchest-<tag>-sheet.png: the sheet's five views (0, 45, 90, 135, 180) of both bodies, each row of the sheet's own
//       views above the model's (his row first, as the sheet);
//     leatherchest-<tag>-wire.png: the same with the polygons' outlines, the triangles by piece;
//     leatherchest-<tag>-poses.png: arms out, arms forward, the walk, the idle, the swing's guard, top and impact, the hands
//       closed on the grip; under each, the armour's triangles crossing the body's (those it leaves showing) and plates on
//       different bones crossing each other;
//     leatherchest-<tag>-full.png: both bodies whole at the game's heights (she is 0.85 of him), front, three-quarter, back;
//     leatherchest-<tag>-walk.gif: the walk clip, both bodies, front and three-quarter;
//     leatherchest-metrics.json: the checks at rest and in every pose, each body.
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { buildRig, posed, skin, ground, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, checks, crossPairs } from './lowgarment.mjs';
import { buildLeatherChest, leatherChestWeights, MATS, LOOKS } from './garments/leatherchest.mjs';
import { shoot, closeBrowser, lookColour, LOOKS as SHOW } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowleatherchest'));
const tag = opt('tag', 'x');
const only = opt('only', 'sheet,metrics').split(',');
mkdirSync(out, { recursive: true });
const DIR = new URL('.', import.meta.url).pathname, ROOT = new URL('../..', import.meta.url).pathname;
const SHEET = join(DIR, 'ref/leather-chest.png');

/* ---- the game's clips and skeleton, bundled for node -------------------------------------------------------------- */
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const modFile = join(out, `.anim-${process.pid}.mjs`);
writeFileSync(modFile, (await build({ stdin: { contents: `export { CLIPS } from './src/sculpt/anim'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text);
const AN = await import(pathToFileURL(modFile).href);
rmSync(modFile);

const SKIN = [0.68, 0.49, 0.41];
const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who), G = buildLeatherChest(rig);
  G.vw = leatherChestWeights(rig, G);
  const hidden = new Set(G.hides);
  M[who] = { rig, G, hidden, shown: rig.B.tris.filter((t) => !hidden.has(t.poly)), body: who === 'male' ? 'man' : 'woman' };
}
const glowCol = (c) => c.map((x) => x + 2);
// (--mats '{"plate":[r,g,b],...}': colours tried over the shared ones, in the pictures only)
const TRY = { ...MATS, ...JSON.parse(opt('mats', '{}')) };
// (a material's colour in a look: plain, or enchanted, its unlit colours drawn as the renderer draws an emissive)
const colOf = (mat, look = 'plain') => { const l = LOOKS[look][mat]; return Array.isArray(l) ? TRY[mat] : lookColour(l); };
const bodyMesh = (who, P, keepPoly = () => true) => {
  const { rig, hidden } = M[who];
  return { who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.filter((t) => !hidden.has(t.poly) && keepPoly(t.poly)).map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) };
};
const armourMesh = (who, P, look = 'plain') => { const { G } = M[who]; return { who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => colOf(p.mat, look)) }; };

/* ---- poses ---------------------------------------------------------------------------------------------------------- */
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
function testPoses(rig) {
  const W = (bone, axis, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
  const symW = (p, bone, axis, deg) => { p[`${bone}_l`] = mm(W(`${bone}_l`, axis, deg), p[`${bone}_l`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); p[`${bone}_r`] = mm(W(`${bone}_r`, [-axis[0], axis[1], axis[2]], -deg), p[`${bone}_r`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); return p; };
  const P = [
    { id: 'tpose', label: 'arms out', pose: symW(symW({}, 'upperarm', Z, 74), 'lowerarm', Z, 10) },
    { id: 'forward', label: 'arms forward', pose: symW(symW(symW({}, 'clavicle', Y, -14), 'upperarm', X, -84), 'upperarm', Y, -2) },
    { id: 'bent', label: 'elbows bent', pose: symW(symW({}, 'upperarm', X, -30), 'lowerarm', X, -110) },
  ];
  if (rig.who === 'female') for (const e of P) e.pose = armsOut(rig, e.pose);
  return P;
}
/** A clip's pose at time t as the rig takes it (lowanim.mjs: the clip player's local turns on the control bones). */
function clipPose(who, name, t) {
  const { rig, body } = M[who], clip = AN.CLIPS[name], sk = AN.lowSkeleton(body);
  const r = AN.clipLocal(sk, clip, t, clip.grip ? AN.lowHeld(body) : undefined), pose = { $move: [0, 0, 0] };
  r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; });
  return pose;
}
const keyT = (name, key) => AN.CLIPS[name].poses.find((p) => p.name === key).t;
function allPoses(who) {
  const { rig } = M[who];
  const walk = AN.CLIPS.walk, idle = AN.CLIPS.idle;
  return [
    { id: 'rest', label: 'rest', pose: {} },
    ...testPoses(rig),
    ...Array.from({ length: 8 }, (_, k) => ({ id: `walk-${k}`, label: `walk ${k + 1}/8`, pose: clipPose(who, 'walk', (k / 8) * walk.length) })),
    ...Array.from({ length: 12 }, (_, k) => ({ id: `idle-${k}`, label: `idle ${k + 1}/12`, pose: clipPose(who, 'idle', (k / 12) * idle.length) })),
    ...['rest', 'drag', 'heave', 'top', 'strike', 'impact', 'follow-through'].map((n) => ({ id: `swing-${n}`, label: `swing ${n === 'rest' ? 'guard' : n}`, pose: clipPose(who, 'swing', keyT('swing', n) + 1e-4) })),
  ];
}
/** Body and armour in a pose, stood on the body's soles. */
function dress(who, pose) {
  const { rig, G } = M[who];
  const f = posed(rig, pose), P0 = skin(rig, f), PB = ground(rig, P0), dy = PB[0][1] - P0[0][1];
  const PG = skinGarment(rig, f, G).map((p) => [p[0], p[1] + dy, p[2]]);
  return { PB, PG, dy };
}
/** Which piece a triangle is of (the plate's tag, decals with their plate), and which bones move it. */
const pieceOf = (G, t) => G.polys[G.tris[t].poly].tag;
const DIAGS = new Set();
let DIAG_ON = false;
function crossings(who, d) {
  const { rig, G, shown } = M[who];
  const body = crossPairs(d.PG, G.tris, d.PB, shown);
  const self = crossPairs(d.PG, G.tris);
  const pairs = {};
  for (const [i, j] of self) { const k = [pieceOf(G, i), pieceOf(G, j)].sort().join('×'); pairs[k] = (pairs[k] ?? 0) + 1; }
  const bodyBy = {};
  for (const [i, j] of body) { const k = `${pieceOf(G, i)}×${rig.B.part[shown[j].v[0]]}`; bodyBy[k] = (bodyBy[k] ?? 0) + 1; }
  // (DIAG=1: which of the body's vertices, by name, and which of the armour's polygons cross)
  if (process.env.DIAG && DIAG_ON) for (const [i, j] of body) DIAGS.add(`${who} ${pieceOf(G, i)}/${G.polys[G.tris[i].poly].mat} × ${shown[j].v.map((v) => rig.B.names[v]).join(' ')}`);
  return { body: body.length, self: self.length, pairs, bodyBy };
}

/* ---- the sheet: five views of both bodies, the sheet's own above each ------------------------------------------------ */
// the sheet's views (leather-chest.png, 1536 x 1024): his row at y 98, hers at 432; its side view the body's left side,
// its rear three-quarter the left side and the back
const CROPS = { male: [[18, 98, 210, 250], [222, 98, 165, 250], [388, 98, 102, 250], [488, 98, 166, 250], [654, 98, 175, 250]], female: [[18, 432, 210, 232], [222, 432, 165, 232], [388, 432, 102, 232], [488, 432, 166, 232], [654, 432, 175, 232]] };
const VK = ['front', 'q3', 'side', 'r3', 'back'];
// the sheet's rows for the chin and the wrists' bands (front view; read off at 3x): the framing that compares the
// armour one to one (the sheet's head is drawn much smaller than ours, so framing by the crown would shrink our armour)
const FRAME = { male: { chin: 128, wrist: 303 }, female: { chin: 462, wrist: 613 } };
const VIEWS = [[0, 'Front (0°)'], [-45, 'Three-quarter (45°)'], [90, 'Side (90°)'], [135, 'Rear three-quarter (135°)'], [180, 'Back (180°)']];
async function sheet(file, wire, look = 'plain') {
  const cw = 230, ch = 280, top = 34, cells = [], imgs = [], texts = [];
  ['male', 'female'].forEach((who, r) => {
    const { G, rig } = M[who], d = dress(who, {});
    // (each cell the sheet's registered camera for that view, tools/sculpt/lowleatherchestcams.json: its turn, scale and
    // place, so the model stands where the sheet's figure does; our own body's proportions, without the sheet's body map)
    const Cm = JSON.parse(readFileSync(join(DIR, 'lowleatherchestcams.json'), 'utf8'))[who];
    // (the body below the faulds' foot left out, as the sheet shows only the armour)
    const cut = who === 'male' ? -7.2 : -6.2;
    const keep = (pi) => rig.B.polys[pi].v.every((i) => d.PB[i][1] > cut);
    VIEWS.forEach(([yaw, lab], i) => {
      imgs.push({ src: SHEET, size: [1536, 1024], crop: CROPS[who][i], box: [i * cw, top + r * 2 * ch, cw, ch] });
      const body = bodyMesh(who, d.PB, keep), arm = armourMesh(who, d.PG, look);
      if (wire) { arm.edges = true; arm.edgec = [0.2, 0.12, 0.08]; }
      // (framed as the sheet frames its figure: the chin and the wrists on the sheet's rows for them, FRAME, so the two
      // rows compare one to one at the same body height; turned as the registered view, on its neck's column)
      const [x, y, w, h] = CROPS[who][i], k = Math.min(cw / w, ch / h), v = Cm.views[VK[i]], sy = v.yaw, F = FRAME[who], J = M[who].rig.J;
      const sF = (F.wrist - F.chin) / (0 - J.wrist[1]);
      const dx = (x + w / 2 - v.cx) / sF, dy = -(y + h / 2 - F.chin) / sF, ca = Math.cos(sy * Math.PI / 180), sa = Math.sin(sy * Math.PI / 180);
      // (the sheet's u = cx + s (cos·x + sin·z); the page's x = cos(-yaw)·x - sin(-yaw)·z: the page's yaw is minus the sheet's)
      cells.push({ meshes: [body, arm], cam: { yaw: -sy, pitch: 0, s: sF * k, c: [dx * ca, dy + d.dy, dx * sa] }, box: [i * cw, top + (r * 2 + 1) * ch, cw, ch], label: `${who} ${lab}` });
    });
    const parts = {};
    for (const t of G.tris) { const p = G.polys[t.poly]; if (G.side[p.v[0]] === 'L' || !/pauldron|zigzag|bracer|rune|band$|sleeve/.test(p.tag)) parts[p.tag] = (parts[p.tag] ?? 0) + 1; }
    texts.push({ cls: 'lab', css: `left:${5 * cw + 10}px;top:${top + r * 2 * ch + 10}px;width:250px;white-space:normal`, html: `<b>${who}</b><br>${G.tris.length} triangles, ${G.hides.length} body polygons hidden<br>above: the sheet; below: the model` + (wire ? '<br><br>by piece (an arm\'s once):<br>' + Object.entries(parts).map(([k, v]) => `${k} ${v}`).join('<br>') : '') });
  });
  texts.push({ css: 'left:10px;top:6px', html: `Leather chest & arms, ${tag}: the sheet (tools/sculpt/ref/leather-chest.png) above each body's row, the model below` });
  await shoot(5 * cw + 270, top + 4 * ch, cells, file, { texts, imgs });
}
/** One view per body large: the sheet's crop and the model beside it at the same framing (FRAME), plain and enchanted. */
async function pair(file, view = 'front') {
  const i = VK.indexOf(view), cw = 460, ch = 560, top = 34, cells = [], imgs = [];
  ['male', 'female'].forEach((who, r) => {
    const { rig } = M[who], d = dress(who, {}), Cm = JSON.parse(readFileSync(join(DIR, 'lowleatherchestcams.json'), 'utf8'))[who];
    const cut = who === 'male' ? -7.2 : -6.2, keep = (pi) => rig.B.polys[pi].v.every((j) => d.PB[j][1] > cut);
    const [x, y, w, h] = CROPS[who][i], k = Math.min(cw / w, ch / h), v = Cm.views[view], sy = v.yaw, F = FRAME[who], J = rig.J;
    const sF = (F.wrist - F.chin) / (0 - J.wrist[1]);
    const dx = (x + w / 2 - v.cx) / sF, dy = -(y + h / 2 - F.chin) / sF, ca = Math.cos(sy * Math.PI / 180), sa = Math.sin(sy * Math.PI / 180);
    imgs.push({ src: SHEET, size: [1536, 1024], crop: CROPS[who][i], box: [r * 3 * cw, top, cw, ch] });
    SHOW.forEach((look, l) => cells.push({ meshes: [bodyMesh(who, d.PB, keep), armourMesh(who, d.PG, look)], cam: { yaw: -sy, pitch: 0, s: sF * k, c: [dx * ca, dy + d.dy, dx * sa] }, box: [(r * 3 + 1 + l) * cw, top, cw, ch], label: `${who} ${view}${look === 'plain' ? '' : ' (enchanted)'}` }));
  });
  await shoot(6 * cw, top + ch, cells, file, { imgs, texts: [{ css: 'left:10px;top:6px', html: `Leather chest & arms, ${tag}: the sheet's ${view} view and the model at the sheet's framing (chin and wrists on the sheet's rows)` }] });
}
if (only.includes('pair')) await pair(join(out, `leatherchest-${tag}-pair-${opt('view', 'front')}.png`), opt('view', 'front'));
if (only.includes('sheet')) for (const look of SHOW) await sheet(join(out, `leatherchest-${tag}-sheet${look === 'plain' ? '' : '-' + look}.png`), false, look);
if (only.includes('wire')) await sheet(join(out, `leatherchest-${tag}-wire.png`), true);

/* ---- metrics -------------------------------------------------------------------------------------------------------- */
if (only.includes('metrics')) {
  const metrics = {};
  for (const who of ['male', 'female']) {
    const { rig, G } = M[who], c = checks(G, G.verts, rig.B, rig.B.verts);
    metrics[who] = { tris: c.tris, open: c.open, nonManifold: c.nonManifold, offPlane: c.offPlane, hides: G.hides.length, bones: rig.bones.length, mats: Object.keys(MATS).length, poses: {} };
    for (const e of allPoses(who)) { DIAG_ON = /^(idle|walk)/.test(e.id); metrics[who].poses[e.id] = crossings(who, dress(who, e.pose)); }
    const P = metrics[who].poses;
    console.log(who, JSON.stringify({ ...metrics[who], poses: undefined }));
    console.log('  ', Object.entries(P).map(([k, v]) => `${k}:${v.body}/${v.self}`).join(' '));
  }
  writeFileSync(join(out, 'leatherchest-metrics.json'), JSON.stringify(metrics, null, 1));
  if (process.env.DIAG) console.log([...DIAGS].filter((d) => !/swing|tpose/.test(d)).join('\n'));
}

/* ---- poses ---------------------------------------------------------------------------------------------------------- */
if (only.includes('poses')) {
  const cw = 230, ch = 300, top = 34, cells = [];
  let row = 0, cols = 0;
  for (const who of ['male', 'female']) {
    const L = allPoses(who).filter((e) => ['rest', 'tpose', 'forward', 'bent', 'walk-2', 'walk-6', 'idle-4', 'swing-rest', 'swing-top', 'swing-impact'].includes(e.id));
    for (const yaw of [-30, 150]) {
      L.forEach((e, k) => {
        const d = dress(who, e.pose), x = crossings(who, d), big = /swing|tpose|forward/.test(e.id);
        cells.push({ meshes: [bodyMesh(who, d.PB), armourMesh(who, d.PG)], cam: { yaw, pitch: -6, s: big ? 20 : 26, c: [0, big ? -1.6 : -2.6, 0] }, box: [k * cw, top + row * ch, cw, ch], label: `${who} ${e.label} · ${x.body}/${x.self}` });
      });
      cols = Math.max(cols, L.length); row++;
    }
  }
  await shoot(cols * cw, top + row * ch, cells, join(out, `leatherchest-${tag}-poses.png`), { texts: [{ css: 'left:10px;top:6px', html: `Leather chest & arms, ${tag}: test poses and the game's clips; under each, the armour's triangles crossing the body's / plates crossing each other` }] });
}

/* ---- both bodies whole ----------------------------------------------------------------------------------------------- */
if (only.includes('full')) {
  const cw = 230, ch = 520, top = 34, cells = [], sc = { male: 1, female: 0.85 };
  let k = 0;
  for (const who of ['male', 'female']) for (const [lab, yaw] of [['front', 0], ['3/4', -40], ['back', 180]]) {
    const d = dress(who, {}), s = sc[who], F = M[who].rig.J.floor, S = (P) => P.map((p) => [p[0] * s, (p[1] - F) * s, p[2] * s]);
    cells.push({ meshes: [bodyMesh(who, S(d.PB)), armourMesh(who, S(d.PG))], cam: { yaw, pitch: 2, s: 34, c: [0, 7.0, 0] }, box: [k++ * cw, top, cw, ch], label: `${who} ${lab}` });
  }
  await shoot(k * cw, top + ch, cells, join(out, `leatherchest-${tag}-full.png`), { texts: [{ css: 'left:10px;top:6px', html: `Leather chest & arms, ${tag}: both bodies whole at the game's heights (she is 0.85 of him)` }] });
}

/* ---- the walk as a GIF ---------------------------------------------------------------------------------------------- */
if (only.includes('walk')) {
  const frames = join(out, `walk-frames-${process.pid}`);
  mkdirSync(frames, { recursive: true });
  const cw = 200, ch = 330, F = 12;
  for (let k = 0; k < F; k++) {
    const cells = [];
    let i = 0;
    for (const who of ['male', 'female']) for (const yaw of [0, -45]) {
      const d = dress(who, clipPose(who, 'walk', (k / F) * AN.CLIPS.walk.length));
      cells.push({ meshes: [bodyMesh(who, d.PB), armourMesh(who, d.PG)], cam: { yaw, pitch: 2, s: 22, c: [0, -4.6, 0] }, box: [i++ * cw, 0, cw, ch] });
    }
    await shoot(cw * 4, ch, cells, join(frames, `f${String(k).padStart(2, '0')}.png`));
  }
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=80, loop=0)
`, frames, join(out, `leatherchest-${tag}-walk.gif`)]);
  rmSync(frames, { recursive: true, force: true });
  console.log('wrote', join(out, `leatherchest-${tag}-walk.gif`));
}
/* ---- close up: one body large, the armour alone and over the body, its outlines ---------------------------------- */
if (only.includes('close')) {
  const who = opt('who', 'male'), cw = 420, ch = 560, cells = [];
  const d = dress(who, {}), c = opt('c', null) ? JSON.parse(opt('c')) : [0, who === 'male' ? -2.6 : -2.3, 0], zs = +opt('s', '62');
  [[0, false], [-45, false], [-90, false], [180, false], [0, true], [-45, true], [-90, true], [180, true]].forEach(([yaw, alone], k) => {
    const arm = armourMesh(who, d.PG); arm.edges = true; arm.edgec = [0.25, 0.15, 0.1];
    cells.push({ meshes: alone ? [arm] : [bodyMesh(who, d.PB), arm], cam: { yaw, pitch: -6, s: zs, c }, box: [(k % 4) * cw, Math.floor(k / 4) * ch, cw, ch], label: `${who} ${yaw}°${alone ? ' (armour alone)' : ''}` });
  });
  await shoot(4 * cw, 2 * ch, cells, join(out, `leatherchest-${tag}-close-${who}.png`));
}
/* ---- beside the tunic's fit (tools/sculpt/garments/tunic.mjs, the approved fit): front, three-quarter, side --------- */
if (only.includes('tunic')) {
  const { buildTunic, MATS: TM } = await import('./garments/tunic.mjs');
  const who = opt('who', 'female'), { rig } = M[who], T = buildTunic(rig), cw = 360, ch = 470, cells = [];
  const d = dress(who, {}), c = [0, who === 'male' ? -2.0 : -1.8, 0];
  const tun = { who, P: T.verts, polys: T.polys.map((p) => p.v), tris: T.tris.map((t) => [...t.v, t.poly]), col: T.polys.map((p) => TM[p.mat]) };
  const bare = { ...bodyMesh(who, rig.B.verts), tris: rig.B.tris.map((t) => [...t.v, t.poly]) };
  [0, -45, -90].forEach((yaw, k) => {
    cells.push({ meshes: [bare, tun], cam: { yaw, pitch: -4, s: 80, c }, box: [k * 2 * cw, 30, cw, ch], label: `${who} ${-yaw}°: the tunic` });
    cells.push({ meshes: [bodyMesh(who, d.PB), armourMesh(who, d.PG)], cam: { yaw, pitch: -4, s: 80, c }, box: [(k * 2 + 1) * cw, 30, cw, ch], label: `${who} ${-yaw}°: the plate` });
  });
  await shoot(6 * cw, ch + 30, cells, join(out, `leatherchest-${tag}-vs-tunic-${who}.png`), { texts: [{ css: 'left:10px;top:4px', html: `Leather chest, ${tag}: the fit beside the tunic's (tools/sculpt/garments/tunic.mjs), close up` }] });
}
/* ---- worn with the rest of the leather set (their assets, from --set <dir>: lowleatherlegs, lowleatherboots, lowleathershawl, lowleatherhat) - */
if (only.includes('set')) {
  const { readFileSync, existsSync } = await import('node:fs');
  const dir = opt('set', '.'), NAMES = (opt("names", "lowleatherlegs,lowleatherboots,lowleathershawl,lowleatherhat")).split(",");
  const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const report = {}, cells = [], cw = 230, ch = 520, top = 34;
  let k = 0;
  for (const who of ['male', 'female']) {
    const { rig, G } = M[who];
    const set = NAMES.filter((n) => existsSync(join(dir, `${n}-${who}.json`))).map((n) => {
      const A = JSON.parse(readFileSync(join(dir, `${n}-${who}.json`), 'utf8'));
      const verts = []; for (let i = 0; i < A.verts.length; i += 3) verts.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
      const tris = []; for (let i = 0; i < A.tris.length; i += 4) tris.push({ v: [A.tris[i], A.tris[i + 1], A.tris[i + 2]], poly: A.tris[i + 3] });
      const vw = A.weights.map((w) => { const o = []; for (let j = 0; j < w.length; j += 2) o.push([w[j], w[j + 1]]); return o; });
      const col = A.polys.map(([, m]) => (A.plain ? lookColour(A.plain[m]) : A.colours[m]));
      return { name: n, P: { verts, tris, vw, bones: [] }, hides: A.hides ?? [], polys: A.polys.map(([v]) => v), col };
    });
    const hidden = new Set([...M[who].hidden, ...set.flatMap((g) => g.hides)]);
    const shownAll = rig.B.tris.filter((t) => !hidden.has(t.poly));
    report[who] = {};
    const poses = allPoses(who).filter((e) => /^(rest|walk|idle|swing-(rest|top|impact))/.test(e.id));
    for (const e of poses) {
      const d = dress(who, e.pose), f = posed(rig, e.pose), dy = d.PB[0][1] - skin(rig, f)[0][1];
      const r = { body: crossPairs(d.PG, G.tris, d.PB, shownAll).length };
      for (const g of set) { const PS = skinGarment(rig, f, g.P).map((p) => [p[0], p[1] + dy, p[2]]); r[g.name] = crossPairs(d.PG, G.tris, PS, g.P.tris).length; }
      report[who][e.id] = r;
    }
    const sc = { male: 1, female: 0.85 }[who], Fl = rig.J.floor;
    for (const [lab, yaw] of [['front', 0], ['3/4', -40], ['side', -90], ['back', 180]]) for (const look of SHOW) {
      const d = dress(who, {}), S = (P) => P.map((p) => [p[0] * sc, (p[1] - Fl) * sc, p[2] * sc]);
      const body = { ...bodyMesh(who, S(d.PB)), tris: shownAll.map((t) => [...t.v, t.poly]) };
      const meshes = [body, armourMesh(who, S(d.PG), look), ...set.map((g) => ({ who, P: S(g.P.verts), polys: g.polys, tris: g.P.tris.map((t) => [...t.v, t.poly]), col: g.col }))];
      cells.push({ meshes, cam: { yaw, pitch: 2, s: 34, c: [0, 7.0, 0] }, box: [k++ * cw, top, cw, ch], label: `${who} ${lab}${look === 'plain' ? '' : ' (enchanted)'}` });
    }
  }
  await shoot(k * cw, top + ch, cells, join(out, `leatherchest-${tag}-set.png`), { texts: [{ css: 'left:10px;top:6px', html: `Leather chest & arms, ${tag}: worn with the leather set.s leggings, boots, shawl and hat (their branches' assets), at the game's heights` }] });
  writeFileSync(join(out, `leatherchest-${tag}-set.json`), JSON.stringify(report, null, 1));
  for (const who in report) {
    const mx = {};
    for (const [id, r] of Object.entries(report[who])) { const g = id.replace(/-\d+$/, ''); for (const [n, v] of Object.entries(r)) { mx[g] ??= {}; mx[g][n] = Math.max(mx[g][n] ?? 0, v); } }
    console.log(who, JSON.stringify(mx));
  }
}
/* ---- crossings by piece: with the body and with the pieces under (--set <dir>), per group of poses (the most) ---------- */
if (only.includes('cross')) {
  const dir = opt('set', join(DIR, 'leather/under')), NAMES = opt('names', 'lowleatherlegs').split(',');
  const { existsSync } = await import('node:fs');
  for (const who of ['male', 'female']) {
    const { rig, G } = M[who];
    const set = NAMES.filter((n) => existsSync(join(dir, `${n}-${who}.json`))).map((n) => {
      const A = JSON.parse(readFileSync(join(dir, `${n}-${who}.json`), 'utf8'));
      const verts = []; for (let i = 0; i < A.verts.length; i += 3) verts.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
      // (the leggings' flaps, `light`, left out unless --flaps: switched off while the chest is worn)
      const skip = n === 'lowleatherlegs' && !args.includes('--flaps') ? ['light'] : [];
      const tris = []; for (let i = 0; i < A.tris.length; i += 4) if (!skip.includes(A.mats[A.polys[A.tris[i + 3]][1]])) tris.push({ v: [A.tris[i], A.tris[i + 1], A.tris[i + 2]], poly: A.tris[i + 3] });
      const vw = A.weights.map((w) => { const o = []; for (let j = 0; j < w.length; j += 2) o.push([w[j], w[j + 1]]); return o; });
      return { name: n, P: { verts, tris, vw, bones: [] }, hides: A.hides ?? [] };
    });
    const hidden = new Set([...M[who].hidden, ...set.flatMap((g) => g.hides)]);
    const shownAll = rig.B.tris.filter((t) => !hidden.has(t.poly));
    const groups = {};
    for (const e of allPoses(who)) {
      const g = e.id.replace(/-\d+$/, '').replace(/^swing-.*/, 'swing'), d = dress(who, e.pose), f = posed(rig, e.pose), dy = d.PB[0][1] - skin(rig, f)[0][1];
      const by = {};
      for (const [i, j] of crossPairs(d.PG, G.tris, d.PB, shownAll)) { const k = `${G.polys[G.tris[i].poly].piece ?? G.polys[G.tris[i].poly].tag}×body.${rig.B.part[shownAll[j].v[0]]}`; by[k] = (by[k] ?? 0) + 1; }
      for (const u of set) { const PS = skinGarment(rig, f, u.P).map((p) => [p[0], p[1] + dy, p[2]]); for (const [i] of crossPairs(d.PG, G.tris, PS, u.P.tris)) { const k = `${G.polys[G.tris[i].poly].piece ?? G.polys[G.tris[i].poly].tag}×${u.name}`; by[k] = (by[k] ?? 0) + 1; } }
      groups[g] ??= {};
      for (const [k, v] of Object.entries(by)) groups[g][k] = Math.max(groups[g][k] ?? 0, v);
    }
    for (const [g, by] of Object.entries(groups)) console.log(who, g, Object.values(by).reduce((a, b) => a + b, 0), JSON.stringify(Object.fromEntries(Object.entries(by).sort((a, b) => b[1] - a[1]))));
  }
}
await closeBrowser();
