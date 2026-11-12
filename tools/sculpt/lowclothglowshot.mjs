// The first outfit's pieces plain and enchanted (each piece's LOOKS: garments/shawl.mjs clothLooks) on both low-poly
// bodies, against their reference sheets:
//
//   node tools/sculpt/lowclothglowshot.mjs --out <dir> [--pieces shawl,tunic,trousers,boots,hood,outfit] [--name clothglow]
//       [--closeup] [--tag text]
//     <name>-<piece>.png: per body, the sheet's five views (front, three-quarter, profile, rear three-quarter, back) above,
//       the model below, each view plain beside enchanted; the pieces worn under it drawn plain (the shawl over the tunic,
//       the tunic over the trousers, the hood up over the shawl), `outfit` every piece and no sheet;
//     <name>-emblem.png (--closeup): the shawl's emblem close, plain and enchanted, facing it and from the side (its
//       height off the cloth), and its edges drawn;
//     <name>-tris.json: each piece's triangles and its materials' count, each body.
//
// The sheets: tools/sculpt/ref/outfit1-shawl.png, outfit1-trousers.png, outfit1-boots.png; the tunic's and the hood's
// (--tunic-sheet <dir> with ref-male-views.png and ref-female-views.png, --hood-sheet <file>) where given.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, lookColour } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowclothglow')), name = opt('name', 'clothglow'), tag = opt('tag', '');
const pieces = opt('pieces', 'shawl,tunic,trousers,boots,hood').split(',');
mkdirSync(out, { recursive: true });
const DIR = new URL('.', import.meta.url).pathname, REF = (f) => join(DIR, 'ref', f);
const TUNIC_SHEETS = opt('tunic-sheet', join(tmpdir(), 'tunic'));
const HOOD_SHEET = opt('hood-sheet', join(tmpdir(), 'hood/hood-sheet.png'));

/* ---- the pieces, built as the game's copies are --------------------------------------------------------------------- */
const need = new Set(pieces.flatMap((p) => (p === 'outfit' ? ['shawl', 'tunic', 'trousers', 'boots', 'hood'] : [p])));
const outfitNeeded = ['shawl', 'tunic', 'trousers', 'hood'].some((p) => need.has(p));
const { buildOutfit } = await import('./garments/outfit1.mjs');
const SH = await import('./garments/shawl.mjs'), TU = await import('./garments/tunic.mjs'), TR = await import('./garments/trousers.mjs');
const BO = await import('./garments/boots.mjs'), HO = await import('./garments/hood.mjs');
// (each piece's materials and looks: the hood's own when it has them, else every material plain both ways)
const looksOf = (mod) => mod.LOOKS ?? SH.clothLooks(mod.MATS);
const KIND = { shawl: SH, tunic: TU, trousers: TR, boots: BO, hood: HO };
const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who), P = {};
  if (outfitNeeded) { const O = buildOutfit(rig); Object.assign(P, { shawl: O.shawl, tunic: O.tunic, trousers: O.trousers }); }
  if (need.has('boots') || need.has('trousers')) { const G = BO.buildBoots(rig); G.vw = BO.bootWeights(rig, G); P.boots = G; }
  if (need.has('hood')) { const G = HO.buildHood(rig, P.shawl, undefined, { under: [P.tunic] }); G.vw = HO.hoodWeights(rig, G, P.shawl); P.hood = G; }
  M[who] = { rig, P };
}

const SKIN = [0.68, 0.49, 0.41];
const bodyMesh = (rig, hidden = new Set()) => ({ who: rig.who, P: rig.B.verts, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.filter((t) => !hidden.has(t.poly)).map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) });
const garMesh = (rig, G, kind, look, o = {}) => {
  const L = looksOf(KIND[kind])[look];
  return { who: rig.who, P: G.verts, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => lookColour(L[p.mat] ?? { c: KIND[kind].MATS[p.mat], kind: 0 })), ...o };
};
/** What each piece is drawn over (plain), and the piece itself in a look. */
const UNDER = { shawl: ['trousers', 'tunic'], tunic: ['trousers'], trousers: ['boots'], boots: ['trousers'], hood: ['trousers', 'tunic', 'shawl'], outfit: [] };
const scene = (who, piece, look, o = {}) => {
  const { rig, P } = M[who];
  const list = piece === 'outfit' ? ['trousers', 'boots', 'tunic', 'shawl', 'hood'] : [...UNDER[piece], piece];
  // (the body less what the trousers, the tunic and the boots hide whole)
  const hidden = new Set([...(list.includes('boots') ? P.boots.hides : []), ...(list.includes('tunic') ? TU.hiddenPolys(rig, P.tunic) : []), ...(list.includes('trousers') ? TR.hiddenPolys(rig, P.trousers) : [])]);
  return [bodyMesh(rig, hidden), ...list.map((k) => garMesh(rig, P[k], k, piece === 'outfit' || k === piece ? look : 'plain', k === piece ? o : {}))];
};

/* ---- the sheets: each piece's five views and where the sheet shows them -------------------------------------------- */
// (yaw: the shawl's, the tunic's and the hood's sheets turn the figure to show its left side, the trousers' and the boots'
// its right; the model's frame round the piece: its height's middle, and its height in the cell `fill` of the cell's)
const VIEW_NAMES = ['Front (0°)', 'Three-quarter (45°)', 'Profile (90°)', 'Rear three-quarter (135°)', 'Back (180°)'];
const SHEETS = {
  shawl: { yaws: [0, 45, 90, 135, 180], cw: 200, ch: 260, pitch: 0, src: () => REF('outfit1-shawl.png'), size: [1528, 425], crops: () => [163, 398, 612, 838, 1052].map((x) => [x - 125, 45, 250, 340]), frame: { lo: -4.2, hi: 2.6 } },
  hood: { yaws: [0, 45, 90, 135, 180], cw: 200, ch: 260, pitch: 0, src: () => HOOD_SHEET, size: [1448, 1086], crops: (who) => ({ female: [90, 229, 364, 507, 641], male: [813, 952, 1087, 1229, 1367] })[who].map((x) => [x - 68, 112, 136, 206]), frame: { lo: -2.6, hi: 3.0 } },
  tunic: { yaws: [0, 45, 90, 135, 180], cw: 200, ch: 300, pitch: 0, src: (who) => join(TUNIC_SHEETS, `ref-${who}-views.png`), size: (who) => (who === 'male' ? [1600, 560] : [1600, 580]), crops: () => [[50, 10, 330, 470], [400, 10, 330, 470], [745, 10, 230, 470], [980, 10, 300, 470], [1265, 10, 335, 470]], piece: true },
  trousers: { yaws: [0, -45, -90, -135, 180], cw: 180, ch: 300, pitch: 0, src: () => REF('outfit1-trousers.png'), size: [1536, 1024], crops: (who) => [105, 268, 407, 556, 720].map((x) => [x - 85, who === 'female' ? 100 : 452, 170, 250]), piece: true },
  boots: { yaws: [0, -45, -90, -135, 180], cw: 200, ch: 220, pitch: -14, src: () => REF('outfit1-boots.png'), size: [1536, 1024], crops: (who) => ({ female: [[22, 112, 200, 205], [228, 112, 170, 205], [382, 112, 152, 205], [533, 112, 210, 205], [738, 112, 128, 205]], male: [[18, 446, 207, 200], [228, 446, 175, 200], [392, 446, 155, 200], [540, 446, 210, 200], [745, 446, 125, 200]] })[who], piece: true },
  outfit: { yaws: [0, 45, 90, 135, 180], cw: 180, ch: 420, pitch: 0, whole: true },
};
/** The piece's height range at rest (with a margin), for the camera. */
function frameOf(who, piece) {
  const S = SHEETS[piece], { rig, P } = M[who];
  if (S.whole) { const ys = rig.B.verts.map((p) => p[1]); return [Math.min(...ys) - 0.3, Math.max(...ys) + 0.3]; }
  if (S.frame) return [S.frame.lo * (who === 'female' ? 0.92 : 1), S.frame.hi];
  const ys = P[piece].verts.map((p) => p[1]), lo = Math.min(...ys), hi = Math.max(...ys), m = (hi - lo) * 0.12;
  return [lo - m, hi + m];
}
const LOOK_NAMES = { plain: 'plain', enchanted: 'enchanted' };
async function sheet(piece, file) {
  const S = SHEETS[piece], { cw, ch } = S, top = 34, refH = S.whole ? 0 : ch, cells = [], imgs = [], texts = [];
  ['male', 'female'].forEach((who, r) => {
    const y0 = top + r * (refH + ch + 30);
    const [lo, hi] = frameOf(who, piece), s = (ch - 24) / (hi - lo), c = [0, (lo + hi) / 2 - 10 / s, 0];
    S.yaws.forEach((yaw, i) => {
      if (!S.whole) {
        const src = S.src(who);
        // (the crop scaled to the box's height, centred over its two cells: no more of the sheet beside it)
        const crop = S.crops(who)[i], bw = Math.min(2 * cw, Math.round((refH * crop[2]) / crop[3]));
        if (existsSync(src)) imgs.push({ src, size: typeof S.size === 'function' ? S.size(who) : S.size, crop, box: [i * 2 * cw + Math.round((2 * cw - bw) / 2), y0, bw, refH] });
      }
      for (const [j, look] of [[0, 'plain'], [1, 'enchanted']]) cells.push({ meshes: scene(who, piece, look), cam: { yaw, pitch: S.pitch, s, c }, box: [(2 * i + j) * cw, y0 + refH, cw, ch], label: j ? LOOK_NAMES[look] : `${who} ${VIEW_NAMES[i].replace(/ \(.*/, '')} · ${LOOK_NAMES[look]}` });
    });
  });
  const tris = piece === 'outfit' ? '' : `; ${['male', 'female'].map((w) => `${w} ${M[w].P[piece].tris.length}`).join(', ')} triangles`;
  texts.push({ css: 'left:10px;top:6px', html: `Outfit 1 ${piece}${tag ? ' — ' + tag : ''}: ${S.whole ? '' : 'the sheet above each body, '}the model plain (left) and enchanted (right) in each view${tris}` });
  await shoot(10 * cw, top + 2 * (refH + ch + 30), cells, file, { texts, imgs });
}

/* ---- the emblem close: facing it and from the side ------------------------------------------------------------------ */
async function closeup(file) {
  const cw = 300, ch = 300, top = 34, cells = [];
  ['male', 'female'].forEach((who, r) => {
    const { P } = M[who], E = P.shawl.emblem, O = E.at, az = E.az;
    const list = [[az, 0, 'plain', false, 'facing it'], [az, 0, 'enchanted', false, 'facing it'], [az + 60, 25, 'plain', false, 'from above the side'], [az + 60, 25, 'enchanted', false, 'from above the side'], [az + 35, 10, 'plain', true, 'its edges']];
    list.forEach(([yaw, pitch, look, edges, lab], k) => cells.push({ meshes: scene(who, 'shawl', look, edges ? { edges: true, edgec: [0.25, 0.15, 0.1] } : {}), cam: { yaw, pitch, s: 130 * (who === 'female' ? 1.15 : 1), c: O }, box: [k * cw, top + r * ch, cw, ch], label: `${who} ${lab} · ${look}` }));
  });
  await shoot(5 * cw, top + 2 * ch, cells, file, { texts: [{ css: 'left:10px;top:6px', html: `The shawl's emblem: a raised strip on the cape (its top and walls), plain and enchanted; ${['male', 'female'].map((w) => `${w} ${M[w].P.shawl.tris.filter((t) => M[w].P.shawl.polys[t.poly].tag === 'emblem').length}`).join(', ')} triangles` }] });
}

for (const piece of pieces) await sheet(piece, join(out, `${name}-${piece}.png`));
if (flag('closeup')) await closeup(join(out, `${name}-emblem.png`));
const T = {};
for (const who of ['male', 'female']) T[who] = Object.fromEntries(Object.entries(M[who].P).map(([k, G]) => [k, { tris: G.tris.length, mats: [...new Set(G.polys.map((p) => p.mat))] }]));
writeFileSync(join(out, `${name}-tris.json`), JSON.stringify(T, null, 1));
await closeBrowser();
