// The plate armour's chest & arms (tools/sculpt/garments/platechest.mjs) on the low-poly bodies, looked over against
// its sheet (tools/sculpt/ref/plate-chest.png) and in the game's clips (src/sculpt/anim: idle, walk, the two-handed swing):
//
//   node tools/sculpt/lowplatechestshot.mjs --out <dir> [--tag <name>] [--only sheet,wire,poses,full,metrics,walk]
//     platechest-<tag>-sheet.png: the sheet's five views (0, 45, 90, 135, 180) of both bodies, each row of the sheet's own
//       views above the model's (his row first, as the sheet);
//     platechest-<tag>-wire.png: the same with the polygons' outlines, the triangles by piece;
//     platechest-<tag>-poses.png: arms out, arms forward, the walk, the idle, the swing's guard, top and impact, the hands
//       closed on the grip; under each, the armour's triangles crossing the body's (those it leaves showing) and plates on
//       different bones crossing each other;
//     platechest-<tag>-full.png: both bodies whole at the game's heights (she is 0.85 of him), front, three-quarter, back;
//     platechest-<tag>-walk.gif: the walk clip, both bodies, front and three-quarter;
//     platechest-metrics.json: the checks at rest and in every pose, each body.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { buildRig, posed, skin, ground, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, checks, crossPairs } from './lowgarment.mjs';
import { buildPlateChest, plateChestWeights, MATS, LOOKS } from './garments/platechest.mjs';
import { shoot, closeBrowser, lookColour, LOOKS as SHOW } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowplatechest'));
const tag = opt('tag', 'x');
const only = opt('only', 'sheet,metrics').split(',');
mkdirSync(out, { recursive: true });
const DIR = new URL('.', import.meta.url).pathname, ROOT = new URL('../..', import.meta.url).pathname;
const SHEET = join(DIR, 'ref/plate-chest.png');

/* ---- the game's clips and skeleton, bundled for node -------------------------------------------------------------- */
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const modFile = join(out, `.anim-${process.pid}.mjs`);
writeFileSync(modFile, (await build({ stdin: { contents: `export { CLIPS } from './src/sculpt/anim'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text);
const AN = await import(pathToFileURL(modFile).href);
rmSync(modFile);

const SKIN = [0.68, 0.49, 0.41];
const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who), G = buildPlateChest(rig);
  G.vw = plateChestWeights(rig, G);
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
  return { PB, PG };
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
// the sheet's views (plate-chest.png, 1536 x 1024): his row at y 95, hers at 438
const CROPS = { male: [[18, 95, 205, 250], [228, 95, 172, 250], [398, 95, 100, 250], [495, 95, 190, 250], [668, 95, 180, 250]], female: [[18, 438, 205, 250], [228, 438, 172, 250], [398, 438, 100, 250], [495, 438, 190, 250], [668, 438, 180, 250]] };
const VIEWS = [[0, 'Front (0°)'], [-45, 'Three-quarter (45°)'], [-90, 'Side (90°)'], [-135, 'Rear three-quarter (135°)'], [180, 'Back (180°)']];
async function sheet(file, wire, look = 'plain') {
  const cw = 230, ch = 280, top = 34, cells = [], imgs = [], texts = [];
  ['male', 'female'].forEach((who, r) => {
    const { G, rig } = M[who], d = dress(who, {});
    const s = who === 'male' ? 37 : 42, c = [0, who === 'male' ? -2.9 : -2.55, 0];
    // (the body below the faulds' foot left out, as the sheet shows only the armour)
    const cut = who === 'male' ? -6.6 : -5.6;
    const keep = (pi) => rig.B.polys[pi].v.every((i) => d.PB[i][1] > cut);
    VIEWS.forEach(([yaw, lab], i) => {
      imgs.push({ src: SHEET, size: [1536, 1024], crop: CROPS[who][i], box: [i * cw, top + r * 2 * ch, cw, ch] });
      const body = bodyMesh(who, d.PB, keep), arm = armourMesh(who, d.PG, look);
      if (wire) { arm.edges = true; arm.edgec = [0.2, 0.12, 0.08]; }
      cells.push({ meshes: [body, arm], cam: { yaw, pitch: -8, s, c }, box: [i * cw, top + (r * 2 + 1) * ch, cw, ch], label: `${who} ${lab}` });
    });
    const parts = {};
    for (const t of G.tris) { const p = G.polys[t.poly]; if (G.side[p.v[0]] === 'L' || !/pauldron|rerebrace|vambrace|diamond|cuff|sleeve|gauntlet/.test(p.tag)) parts[p.tag] = (parts[p.tag] ?? 0) + 1; }
    texts.push({ cls: 'lab', css: `left:${5 * cw + 10}px;top:${top + r * 2 * ch + 10}px;width:250px;white-space:normal`, html: `<b>${who}</b><br>${G.tris.length} triangles, ${G.hides.length} body polygons hidden<br>above: the sheet; below: the model` + (wire ? '<br><br>by piece (an arm\'s once):<br>' + Object.entries(parts).map(([k, v]) => `${k} ${v}`).join('<br>') : '') });
  });
  texts.push({ css: 'left:10px;top:6px', html: `Plate chest & arms, ${tag}: the sheet (tools/sculpt/ref/plate-chest.png) above each body's row, the model below` });
  await shoot(5 * cw + 270, top + 4 * ch, cells, file, { texts, imgs });
}
if (only.includes('sheet')) for (const look of SHOW) await sheet(join(out, `platechest-${tag}-sheet${look === 'plain' ? '' : '-' + look}.png`), false, look);
if (only.includes('wire')) await sheet(join(out, `platechest-${tag}-wire.png`), true);

/* ---- against the sheet: the review pose on the sheet's body map, under each view's camera ------------------------- */
// platechest-<tag>-review-<who>.png: per view the sheet, ours (with the body, in the browser renderer) and ours over the
// sheet; a row per look (plain, and enchanted with --enchanted)
if (only.includes('review')) {
  const V = await import('./lowplatechestview.mjs');
  for (const who of ['male', 'female']) {
    const { rig, G, hidden } = M[who], C = V.loadCams()[who], { PB, PG } = V.reviewVerts(rig, G, C);
    const cut = who === 'male' ? -7.2 : -6.2;
    const boxes = V.VIEWS.map((v) => V.MASKS.views[who][v].box);
    const sizes = boxes.map((b) => [(b[2] - b[0]) * V.K, (b[3] - b[1]) * V.K]);
    const files = [];
    for (const look of SHOW) {
      const cells = [];
      let x = 0;
      V.VIEWS.forEach((v, i) => {
        const yaw = C.views[v].yaw * Math.PI / 180, ca = Math.cos(yaw), sa = Math.sin(yaw);
        const cam = (P) => P.map((p) => [ca * p[0] + sa * p[2], p[1], -sa * p[0] + ca * p[2]]);
        const [bw, bh] = sizes[i], S = C.s * V.K, b = boxes[i];
        const c = [(bw / 2 - (C.views[v].cx - b[0]) * V.K) / S, ((C.cy - b[1]) * V.K - bh / 2) / S, 0];
        const body = bodyMesh(who, cam(PB), (pi) => rig.B.polys[pi].v.every((j) => PB[j][1] > cut) && rig.B.part[rig.B.polys[pi].v[0]] !== 'head');
        cells.push({ meshes: [body, armourMesh(who, cam(PG), look)], cam: { yaw: 0, pitch: 0, s: S, c }, box: [x, 0, bw, bh], bg: [0.176, 0.11, 0.118] });
        x += bw;
      });
      const f = join(out, `.review-${who}-${look}-${process.pid}.png`);
      await shoot(x, Math.max(...sizes.map((z) => z[1])), cells, f);
      files.push([look, f]);
    }
    const dst = join(out, `platechest-${tag}-review-${who}.png`);
    execFileSync('python3', ['-c', `
import sys, json, os
from PIL import Image, ImageDraw
a = json.loads(sys.argv[1]); S = Image.open(a['sheet']).convert('RGB'); K = a['K']
rows = []
for look, f in a['files']:
    im = Image.open(f).convert('RGB'); x = 0; tiles = []
    for v, b in zip(a['views'], a['boxes']):
        w, h = (b[2] - b[0]) * K, (b[3] - b[1]) * K
        sh = S.crop(tuple(b)).resize((w, h), Image.LANCZOS); ours = im.crop((x, 0, x + w, h)); x += w
        tiles += [(sh, v + ': the sheet'), (ours, 'ours' + ('' if look == 'plain' else ' (enchanted)')), (Image.blend(sh, ours, 0.5), 'ours over the sheet')]
    rows.append(tiles)
    os.remove(f)
W = sum(t[0].size[0] for t in rows[0]); H = sum(max(t[0].size[1] for t in r) + 18 for r in rows) + 24
out = Image.new('RGB', (W, H), (28, 24, 26)); d = ImageDraw.Draw(out); d.text((6, 6), a['title'], fill=(240, 225, 205)); y = 24
for r in rows:
    x = 0
    for t, lab in r: out.paste(t, (x, y + 18)); d.text((x + 4, y + 3), lab, fill=(230, 215, 190)); x += t.size[0]
    y += max(t[0].size[1] for t in r) + 18
out.save(a['dst'])
`, JSON.stringify({ sheet: SHEET, K: V.K, files, views: V.VIEWS, boxes, dst, title: `Plate chest & arms ${tag}, ${who}: the sheet, ours (the review pose, on the sheet's body: ${JSON.stringify(C.pose)}), ours over the sheet` })]);
    console.log('wrote', dst);
  }
}

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
  writeFileSync(join(out, 'platechest-metrics.json'), JSON.stringify(metrics, null, 1));
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
  await shoot(cols * cw, top + row * ch, cells, join(out, `platechest-${tag}-poses.png`), { texts: [{ css: 'left:10px;top:6px', html: `Plate chest & arms, ${tag}: test poses and the game's clips; under each, the armour's triangles crossing the body's / plates crossing each other` }] });
}

/* ---- both bodies whole ----------------------------------------------------------------------------------------------- */
if (only.includes('full')) {
  const cw = 230, ch = 520, top = 34, cells = [], sc = { male: 1, female: 0.85 };
  let k = 0;
  for (const who of ['male', 'female']) for (const [lab, yaw] of [['front', 0], ['3/4', -40], ['back', 180]]) {
    const d = dress(who, {}), s = sc[who], F = M[who].rig.J.floor, S = (P) => P.map((p) => [p[0] * s, (p[1] - F) * s, p[2] * s]);
    cells.push({ meshes: [bodyMesh(who, S(d.PB)), armourMesh(who, S(d.PG))], cam: { yaw, pitch: 2, s: 34, c: [0, 7.0, 0] }, box: [k++ * cw, top, cw, ch], label: `${who} ${lab}` });
  }
  await shoot(k * cw, top + ch, cells, join(out, `platechest-${tag}-full.png`), { texts: [{ css: 'left:10px;top:6px', html: `Plate chest & arms, ${tag}: both bodies whole at the game's heights (she is 0.85 of him)` }] });
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
`, frames, join(out, `platechest-${tag}-walk.gif`)]);
  rmSync(frames, { recursive: true, force: true });
  console.log('wrote', join(out, `platechest-${tag}-walk.gif`));
}
/* ---- close up: one body large, the armour alone and over the body, its outlines ---------------------------------- */
if (only.includes('close')) {
  const who = opt('who', 'male'), cw = 420, ch = 560, cells = [];
  const d = dress(who, {}), c = opt('c', null) ? JSON.parse(opt('c')) : [0, who === 'male' ? -2.6 : -2.3, 0], zs = +opt('s', '62');
  [[0, false], [-45, false], [-90, false], [180, false], [0, true], [-45, true], [-90, true], [180, true]].forEach(([yaw, alone], k) => {
    const arm = armourMesh(who, d.PG); arm.edges = true; arm.edgec = [0.25, 0.15, 0.1];
    cells.push({ meshes: alone ? [arm] : [bodyMesh(who, d.PB), arm], cam: { yaw, pitch: -6, s: zs, c }, box: [(k % 4) * cw, Math.floor(k / 4) * ch, cw, ch], label: `${who} ${yaw}°${alone ? ' (armour alone)' : ''}` });
  });
  await shoot(4 * cw, 2 * ch, cells, join(out, `platechest-${tag}-close-${who}.png`));
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
  await shoot(6 * cw, ch + 30, cells, join(out, `platechest-${tag}-vs-tunic-${who}.png`), { texts: [{ css: 'left:10px;top:4px', html: `Plate chest, ${tag}: the fit beside the tunic's (tools/sculpt/garments/tunic.mjs), close up` }] });
}
/* ---- worn with the rest of the plate set (their assets, from --set <dir>: lowplatelegs, lowplateboots, lowhelm, lowmantle) - */
if (only.includes('set')) {
  const { readFileSync, existsSync } = await import('node:fs');
  const dir = opt('set', '.'), NAMES = ['lowplatelegs', 'lowplateboots', 'lowhelm', 'lowmantle'];
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
  await shoot(k * cw, top + ch, cells, join(out, `platechest-${tag}-set.png`), { texts: [{ css: 'left:10px;top:6px', html: `Plate chest & arms, ${tag}: worn with the plate set's leggings, boots, helm and mantle (their branches' assets), at the game's heights` }] });
  writeFileSync(join(out, `platechest-${tag}-set.json`), JSON.stringify(report, null, 1));
  for (const who in report) {
    const mx = {};
    for (const [id, r] of Object.entries(report[who])) { const g = id.replace(/-\d+$/, ''); for (const [n, v] of Object.entries(r)) { mx[g] ??= {}; mx[g][n] = Math.max(mx[g][n] ?? 0, v); } }
    console.log(who, JSON.stringify(mx));
  }
}
await closeBrowser();
