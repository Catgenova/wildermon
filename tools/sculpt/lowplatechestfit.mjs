// The plate chest (tools/sculpt/garments/platechest.mjs) against the sheet's pieces (tools/sculpt/plate/chest-masks.json,
// lowplatechestmask.py), under the registered cameras, review pose and body map (lowplatechestcams.json,
// lowplatechestreg.mjs; drawn by lowplatechestview.mjs):
//
//   node tools/sculpt/lowplatechestfit.mjs --out <dir> --tag <name> [--enchanted] [--solve]
//     --solve: each plate's outline read off the sheet onto the body (lowplatechestsolve.mjs) and written to
//       tools/sculpt/plate/chest-fit.json, which the build takes over DESIGN, before the pictures;
//     platechest-<tag>-<who>.png: per view the sheet, ours, and ours over the sheet, at 2x (plain, and enchanted with
//       --enchanted);
//     platechest-<tag>-pieces-<who>.png: per view each piece in its own colour, ours filled and the sheet's outlined;
//     platechest-<tag>-fit.json: per body, view and piece the IoU of ours (its visible pixels) and the sheet's, and the
//       mean distance (px) from each outline to the other.
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { buildPlateChest, plateChestWeights, LOOKS, MATS } from './garments/platechest.mjs';
import { VIEWS, K, PIECES, reviewVerts, proj, sheetLabels, sheetCanvas, canvas, fillTri, shadeOf, savePNG, loadCams, mkdir } from './lowplatechestview.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = mkdir(resolve(opt('out', 'tmp/lowplatechest'))), tag = opt('tag', 'x');
const looks = args.includes('--enchanted') ? ['plain', 'enchanted'] : ['plain'];
const BG = [45, 28, 30];

if (args.includes('--solve')) { const { solve } = await import('./lowplatechestsolve.mjs'); await solve(); }

/** The sheet's piece a polygon of the armour is (its own `piece`, the side by where it lies). */
export function pieceOf(G, k) {
  const p = G.polys[k];
  if (p.piece) return p.piece;
  const x = p.v.reduce((s, i) => s + G.verts[i][0], 0) / p.v.length, s = x >= 0 ? 'l' : 'r', t = p.tag;
  const T = { breast: 'breast', 'breast core': 'breast', inlay: 'breast', back: 'back', 'lame 1': 'lame1', 'lame 2': 'lame2', 'lame 3': 'belt', collar: 'collar.back' };
  if (T[t]) return T[t];
  if (/^pauldron lame (\d)/.test(t)) return `plame${t.slice(-1)}.${s}`;
  if (/^pauldron/.test(t)) return `pauldron.${s}`;
  if (/^(vambrace|diamond)/.test(t)) return `vambrace.${s}`;
  if (t === 'sleeve') return `under.${s}`;
  if (['rerebrace', 'cuff', 'gauntlet'].includes(t)) return `${t}.${s}`;
  if (/^fauld/.test(t)) { const z = p.v.reduce((a, i) => a + G.verts[i][2], 0) / p.v.length; return z < -0.2 ? 'fauld.b' : Math.abs(x) < 0.45 ? 'fauld.f' : `fauld.${s}`; }
  return null;
}
const colOf = (mat, look) => { const l = LOOKS[look][mat]; const c = Array.isArray(l) ? l : l.c; return l.kind === 1 ? null : c; };
const glowOf = (mat, look) => { const l = LOOKS[look][mat]; return l.kind === 1 ? l.c : null; };
// each piece's colour in the pieces picture
const HUE = PIECES.map((_, i) => { const h = (i * 0.618) % 1, f = (n) => { const k = (n + h * 6) % 6; return 0.75 - 0.6 * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)].map((x) => Math.round(x * 255)); });

const fit = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who), G = buildPlateChest(rig);
  G.vw = plateChestWeights(rig, G);
  const Cm = loadCams()[who], { PG } = reviewVerts(rig, G, Cm);
  const lab = G.polys.map((_, k) => PIECES.indexOf(pieceOf(G, k)) + 1);
  fit[who] = {};
  const rows = { main: [], pieces: [] };
  for (const v of VIEWS) {
    const S = sheetLabels(who, v), box = [S.x0, S.y0, S.x0 + S.W, S.y0 + S.H];
    const P = PG.map((p) => { const q = proj(p, Cm, v); return [(q[0] - S.x0) * K, (q[1] - S.y0) * K, q[2]]; });
    // ours, at 2x, per look; and the labels (the nearest polygon's piece)
    const R = {};
    for (const look of looks) {
      R[look] = canvas(S.W * K, S.H * K, BG);
      for (const t of G.tris) {
        const [a, b, c] = t.v.map((i) => P[i]), m = G.polys[t.poly].mat, g = glowOf(m, look);
        fillTri(R[look], a, b, c, g ? g.map((x) => Math.round(x * 255)) : shadeOf(colOf(m, look), a, b, c), lab[t.poly]);
      }
    }
    const L = R.plain.l;
    // the IoU per piece at 2x (the sheet's labels upsampled), and the outlines' mean distance
    const SL = new Uint8Array(L.length);
    for (let y = 0; y < S.H * K; y++) for (let x = 0; x < S.W * K; x++) SL[y * S.W * K + x] = S.L[Math.floor(y / K) * S.W + Math.floor(x / K)];
    const W2 = S.W * K, H2 = S.H * K, res = {};
    const edgeOf = (M, k) => { const e = []; for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) { const i = y * W2 + x; if (M[i] === k && (M[i - 1] !== k || M[i + 1] !== k || M[i - W2] !== k || M[i + W2] !== k)) e.push([x, y]); } return e; };
    const meanDist = (A, Bp) => { if (!A.length || !Bp.length) return null; let s = 0; for (const [x, y] of A) { let b = 1e9; for (const [u, w] of Bp) { const d = (x - u) ** 2 + (y - w) ** 2; if (d < b) b = d; } s += Math.sqrt(b); } return s / A.length / K; };
    let I = 0, U = 0;
    for (let k = 1; k <= PIECES.length; k++) {
      let i = 0, u = 0, a = 0, b = 0;
      for (let j = 0; j < L.length; j++) { const o = L[j] === k, s = SL[j] === k; if (o) a++; if (s) b++; if (o && s) i++; if (o || s) u++; }
      if (!u) continue;
      const ea = edgeOf(L, k), eb = edgeOf(SL, k), step = (e) => e.filter((_, n) => n % 3 === 0);
      const d = a && b ? (meanDist(step(ea), eb) + meanDist(step(eb), ea)) / 2 : null;
      res[PIECES[k - 1]] = { iou: +(i / u).toFixed(3), px: d === null ? null : +d.toFixed(2), ours: a / K / K, sheet: b / K / K };
    }
    for (let j = 0; j < L.length; j++) { const o = L[j] > 0, s = SL[j] > 0; if (o && s) I++; if (o || s) U++; }
    fit[who][v] = { silhouette: +(I / U).toFixed(3), pieces: res };
    // the pictures
    const sheet = sheetCanvas(out, box);
    for (const look of looks) {
      const ov = canvas(W2, H2);
      for (let j = 0; j < L.length; j++) for (let c = 0; c < 3; c++) ov.c[j * 3 + c] = Math.round(sheet.c[j * 3 + c] * 0.5 + R[look].c[j * 3 + c] * 0.5);
      const mark = (M, rgb) => { for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) { const i = y * W2 + x; if ((M[i] > 0) !== (M[i + 1] > 0) || (M[i] > 0) !== (M[i + W2] > 0)) ov.c.set(rgb, i * 3); } };
      mark(SL, [40, 255, 60]); mark(L, [255, 40, 40]);
      const nm = look === 'plain' ? '' : ' enchanted';
      rows.main.push([{ R: sheet, label: `${v}: the sheet` }, { R: R[look], label: `ours${nm}` }, { R: ov, label: `over: silhouette IoU ${fit[who][v].silhouette}` }]);
    }
    // each piece in its colour: ours filled, the sheet's outlined in the same colour
    const pc = canvas(W2, H2, [20, 16, 18]);
    for (let j = 0; j < L.length; j++) if (L[j]) pc.c.set(HUE[L[j] - 1].map((x) => x * 0.8), j * 3);
    for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) { const i = y * W2 + x, k = SL[i]; if (k && (SL[i - 1] !== k || SL[i + 1] !== k || SL[i - W2] !== k || SL[i + W2] !== k)) pc.c.set(HUE[k - 1].map((c) => Math.min(255, c * 1.25 + 40)), i * 3); }
    const sm = canvas(W2, H2, [20, 16, 18]);
    for (let j = 0; j < L.length; j++) if (SL[j]) sm.c.set(HUE[SL[j] - 1].map((x) => x * 0.8), j * 3);
    const mean = Object.values(res).filter((r) => r.ours && r.sheet);
    rows.pieces.push([{ R: sm, label: `${v}: the sheet's pieces` }, { R: pc, label: `ours filled, the sheet's outlined; mean IoU ${(mean.reduce((s, r) => s + r.iou, 0) / Math.max(1, mean.length)).toFixed(2)}` }]);
  }
  // five views in a row: sheet | ours | over (per look)
  const per = looks.length;
  const main = [];
  for (let l = 0; l < per; l++) main.push(VIEWS.flatMap((_, i) => rows.main[i * per + l]));
  savePNG(join(out, `platechest-${tag}-${who}.png`), main, { title: `plate chest ${tag}, ${who}: the sheet, ours, ours over the sheet (red ours, green the sheet's outline); review pose and the sheet's body map` });
  savePNG(join(out, `platechest-${tag}-ov-${who}.png`), [main[0].filter((_, i) => i % 3 === 2), main[0].filter((_, i) => i % 3 === 1)], { title: `plate chest ${tag}, ${who}: ours over the sheet (red ours, green the sheet's outline); ours` });
  savePNG(join(out, `platechest-${tag}-pieces-${who}.png`), [rows.pieces.flat()], { title: `plate chest ${tag}, ${who}: per piece, the sheet's (left) and ours filled with the sheet's outlined in the same colour (right)` });
  const tab = {};
  for (const v of VIEWS) for (const [p, r] of Object.entries(fit[who][v].pieces)) (tab[p] ??= {})[v] = r.iou;
  console.log(who, VIEWS.map((v) => `${v} ${fit[who][v].silhouette}`).join(' '));
  for (const [p, r] of Object.entries(tab)) console.log('  ', p.padEnd(12), VIEWS.map((v) => (r[v] === undefined ? '  -  ' : r[v].toFixed(2))).join(' '));
}
writeFileSync(join(out, `platechest-${tag}-fit.json`), JSON.stringify(fit, null, 1));
