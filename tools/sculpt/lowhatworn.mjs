// The feathered cap worn with its neighbours of the leather set: other checkouts' garments (their game assets,
// src/sculpt/assets/<file>-<who>.json, as garmentAsset wrote them) drawn with the hat, the body and the swept-back hair,
// at rest and with the head turned and nodded (the tools' skinning: lowrig.mjs posed, each garment by its own weights,
// its own bones driven as the game drives them), both bodies, front, three-quarter, side and back, plain and enchanted.
//
//   node tools/sculpt/lowhatworn.mjs --out <dir> --with <root>:<file>[,<root>:<file>...] [--tag <name>]
//     e.g. --with ../shawl:lowleathershawl,../chest:lowleatherchest
//     writes <dir>/hat-worn-<who><tag>.png: per pose a row, the views across (at rest plain then enchanted), each with
//     the hat's triangles crossing each neighbour's
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { buildRig, posed, skin } from './lowrig.mjs';
import { skinGarment, crossPairs, trisOf } from './lowgarment.mjs';
import { buildHat, hatWeights, hairMesh, MATS, LOOKS } from './garments/hat.mjs';
import { shoot, closeBrowser, lookColour } from './lowgarmentshot.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowhatworn')), tag = opt('tag', '');
const WITH = opt('with', '').split(',').filter(Boolean).map((s) => { const [root, file] = s.split(':'); return { root, file }; });
mkdirSync(out, { recursive: true });
const SKIN = [0.68, 0.49, 0.41], HAIRC = { 3: [0.36, 0.27, 0.23], 4: [0.25, 0.16, 0.12] };
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);

/** A garment asset as a tools mesh: vertices, weights, polygons with their colours per look, its own bones. */
function assetMesh(rig, a) {
  const verts = [], vw = [], polys = a.polys.map(([v]) => v), tris = [];
  for (let i = 0; i < a.verts.length; i += 3) verts.push([a.verts[i], a.verts[i + 1], a.verts[i + 2]]);
  for (const w of a.weights) { const l = []; for (let j = 0; j < w.length; j += 2) l.push([w[j], w[j + 1]]); vw.push(l); }
  const col = (look) => a.polys.map(([, m]) => { const L = a[look]?.[m]; return L ? lookColour({ c: hex(L.c), kind: L.kind }) : a.colours[m]; });
  for (let k = 0; k < a.tris.length; k += 4) tris.push({ v: [a.tris[k], a.tris[k + 1], a.tris[k + 2]], poly: a.tris[k + 3], glow: a.glowFrom !== undefined && a.tris[k + 3] >= a.glowFrom });
  const bones = (a.bones ?? []).map((b) => ({ name: b.name, parent: rig.bones[b.p].name, head: b.head, R: b.R, kind: 'helper', driver: { from: rig.bones[b.from].name, kind: b.drive, ...Object.fromEntries(Object.entries(b).filter(([k]) => !['name', 'p', 'kind', 'head', 'R', 'from', 'drive'].includes(k))) } }));
  return { verts, vw, polys, tris, bones, col: { plain: col('plain'), enchanted: col('enchanted') }, hides: a.hides ?? [] };
}
const POSES = {
  rest: {},
  'turn 70': { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] },
  'turn 70 right': { neck_01: [0, -16, 0], neck_02: [0, -16, 0], head: [0, -38, 0] },
  'nod 40': { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] },
  'back 20': { neck_01: [-6, 0, 0], neck_02: [-7, 0, 0], head: [-7, 0, 0] },
};
const VIEWS = [[0, 'front'], [40, '3/4'], [90, 'side'], [180, 'back']];
const cw = 230, ch = 270;
const report = {};
for (const who of ['male', 'female']) {
  const rows = [];
  const rig = buildRig(who), G = buildHat(rig), H = hairMesh(who), head = rig.at.get('head');
  G.vw = hatWeights(rig, G);
  const N = WITH.map((w) => ({ ...w, M: assetMesh(rig, JSON.parse(readFileSync(join(w.root, `src/sculpt/assets/${w.file}-${who}.json`), 'utf8'))) }));
  const hidden = new Set(N.flatMap((n) => n.M.hides));
  report[who] = {};
  for (const [pn, pose] of Object.entries(POSES)) {
    const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G), PH = skinGarment(rig, f, { verts: H.verts, bones: [] }, H.verts.map(() => [[head, 1]]));
    const PN = N.map((n) => skinGarment(rig, f, n.M));
    const x = N.map((n, k) => crossPairs(PG, trisOf(G), PN[k], n.M.tris.filter((t) => !t.glow)).length);
    report[who][pn] = Object.fromEntries(N.map((n, k) => [n.file, x[k]]));
    // (each pose shot on its own, to keep the page small; the rows joined after)
    const cells = [];
    (pn === 'rest' ? ['plain', 'enchanted'] : ['plain']).forEach((look, l) => {
      const hatCol = Object.fromEntries(Object.entries(MATS).map(([k, c]) => [k, lookColour(LOOKS[look][k] ?? { c, kind: 0 })]));
      const meshes = [
        { who, P: PB, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.filter((t) => !hidden.has(t.poly)).map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p, pi) => (H.shave.includes(pi) ? HAIRC[3] : p.mat === 'skin' ? SKIN : [0.15, 0.1, 0.1])) },
        { who, P: PH, polys: H.polys, tris: H.tris.map((t) => [...t.v, t.poly]), col: H.mat.map((m) => HAIRC[m] ?? HAIRC[4]) },
        ...N.map((n, k) => ({ who, P: PN[k], polys: n.M.polys, tris: n.M.tris.filter((t) => look === 'enchanted' || !t.glow).map((t) => [...t.v, t.poly]), col: n.M.col[look] })),
        { who, P: PG, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => hatCol[p.mat]) },
      ];
      VIEWS.forEach(([yaw, vn], i) => cells.push({ meshes, cam: { yaw, pitch: -8, s: 40, c: [0, 0.4, 0] }, box: [(l * VIEWS.length + i) * cw, 0, cw, ch], label: i === 0 ? `${who} ${pn} · ${look}` : i === 1 ? N.map((n, k) => `${n.file.replace('lowleather', '')} ${x[k]}`).join(', ') : vn }));
    });
    const file = join(out, `worn-row-${who}-${rows.length}.png`);
    await shoot(2 * VIEWS.length * cw, ch, cells, file);
    rows.push(file);
  }
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
R = [Image.open(f).convert('RGB') for f in sys.argv[2:]]
out = Image.new('RGB', (max(r.width for r in R), sum(r.height for r in R)), (54, 42, 46)); y = 0
for r in R: out.paste(r, (0, y)); y += r.height
out.save(sys.argv[1])
`, join(out, `hat-worn-${who}${tag}.png`), ...rows]);
  for (const f of rows) rmSync(f);
}
await closeBrowser();
console.log(JSON.stringify(report));
