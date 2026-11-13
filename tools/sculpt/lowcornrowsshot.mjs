// The cornrows' review sheets (tools/sculpt/lowcornrows.mjs on the low-poly bodies), drawn by tools/sculpt/lowhairshot.mjs
// shoot: each body's head and shoulders from the front, the three-quarter, the side, the back and above.
//
//   node tools/sculpt/lowcornrowsshot.mjs --out <dir> [--tag -x] [--only views,wire,hat,sheet]
// views: cornrows-views<tag>.png, both bodies, five views; wire: cornrows-wire<tag>.png, the polygons' outlines;
// hat: cornrows-hat<tag>.png, under the leather hat as the game draws it (src/sculpt/assets/lowhat-<who>.json's
// 'cornrows', tools/sculpt/garments/hat.mjs hatHair; run `node tools/sculpt/garments/hat.mjs` first); sheet:
// cornrows-sheet<tag>.png, both bodies, four views, two hair colours.
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, bodyMesh, hairMesh, SHEET_HAIR } from './lowhairshot.mjs';
import { cornrowsOf } from './lowcornrows.mjs';
import { buildHat, MATS } from './garments/hat.mjs';

const VIEWS = [[0, 0, 'Front'], [-45, 0, 'Three-quarter'], [-90, 0, 'Side'], [180, 0, 'Back'], [0, -70, 'Above']];
const WHO = { male: 'man', female: 'woman' };
/** The second hair colour on the final sheet: near black. */
const DARK = [0.13, 0.1, 0.09];

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowcornrows')); mkdirSync(out, { recursive: true });
const only = opt('only', 'views').split(','), tag = opt('tag', '');
const RIGS = { male: buildRig('male'), female: buildRig('female') };
const HAIRS = Object.fromEntries(Object.entries(RIGS).map(([w, r]) => [w, cornrowsOf(r)]));
const cw = 300, ch = 330, gap = 6, top = 34;
const cam = (yaw, pitch, s = 135) => ({ yaw, pitch, s, c: [0, 1.25, -0.05] });
const parts = { parts: ['head', 'neck', 'torso'] };

const sheet = async (file, title, rows, views = VIEWS, o = {}) => {
  const cells = [];
  rows.forEach((meshesAt, r) => views.forEach(([yaw, pitch, label], i) => cells.push({ meshes: meshesAt(i), cam: cam(yaw, pitch), box: [10 + i * (cw + gap), top + r * (ch + gap), cw, ch], label: `${o.labels?.[r] ?? ''}${label}` })));
  await shoot(20 + views.length * (cw + gap), top + rows.length * (ch + gap) + 10, cells, join(out, file), { texts: [{ css: 'left:12px;top:6px', html: title }] });
  console.log('wrote', join(out, file));
};

if (only.includes('views')) await sheet(`cornrows-views${tag}.png`, `Cornrows: man (top), woman (bottom): ${HAIRS.male.tris.length} / ${HAIRS.female.tris.length} triangles, ${HAIRS.male.pieces.length} / ${HAIRS.female.pieces.length} links`,
  ['male', 'female'].map((w) => () => [bodyMesh(RIGS[w], HAIRS[w], RIGS[w].B.verts, SHEET_HAIR, parts), hairMesh(RIGS[w], HAIRS[w])]), VIEWS, { labels: ['Man ', 'Woman '] });

if (only.includes('wire')) await sheet(`cornrows-wire${tag}.png`, 'Cornrows: the polygons, man (top), woman (bottom)',
  ['male', 'female'].map((w) => () => [{ ...bodyMesh(RIGS[w], HAIRS[w], RIGS[w].B.verts, SHEET_HAIR, parts), edges: true, edgec: [0.95, 0.85, 0.78] }, { ...hairMesh(RIGS[w], HAIRS[w]), edges: true, edgec: [1, 0.93, 0.85] }]), VIEWS, { labels: ['Man ', 'Woman '] });

if (only.includes('hat')) {
  // the hair as the game draws it under the hat: the hat asset's pressed copy
  const rows = ['male', 'female'].map((w) => {
    const A = JSON.parse(readFileSync(new URL(`../../src/sculpt/assets/lowhat-${w}.json`, import.meta.url), 'utf8')).hair.cornrows;
    const H = { ...HAIRS[w], verts: [] }; for (let i = 0; i < A.verts.length; i += 3) H.verts.push(A.verts.slice(i, i + 3));
    const G = buildHat(RIGS[w]), hat = { who: w, P: G.verts, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => MATS[p.mat] ?? MATS.leather) };
    return () => [bodyMesh(RIGS[w], H, RIGS[w].B.verts, SHEET_HAIR, parts), hairMesh(RIGS[w], H), hat];
  });
  await sheet(`cornrows-hat${tag}.png`, 'Cornrows under the leather hat (pressed: src/sculpt/assets/lowhat-*.json), man (top), woman (bottom)', rows, VIEWS.slice(0, 4), { labels: ['Man ', 'Woman '] });
}

if (only.includes('sheet')) {
  const rows = [];
  for (const col of [SHEET_HAIR, DARK]) for (const w of ['male', 'female']) rows.push(() => [bodyMesh(RIGS[w], HAIRS[w], RIGS[w].B.verts, col, parts), hairMesh(RIGS[w], HAIRS[w], HAIRS[w].verts, col)]);
  await sheet(`cornrows-sheet${tag}.png`, `Cornrows, both bodies, four views, two hair colours: ${HAIRS.male.tris.length} / ${HAIRS.female.tris.length} triangles`, rows, VIEWS.slice(0, 4),
    { labels: ['Man, brown: ', 'Woman, brown: ', 'Man, black: ', 'Woman, black: '] });
}
await closeBrowser();
