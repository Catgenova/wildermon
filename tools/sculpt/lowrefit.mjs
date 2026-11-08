// The garments' weights refitted to the game's clips (src/sculpt/anim: the walk and the idle, as lowgarmentcheck.mjs
// samples them): a search on the game's own path (lowScene's bake and bones, skinned as the shader skins them) that
// changes one garment's weights vertex by vertex, each change with its mirror (the bones' sides swapped), keeping a
// change only when the garment's triangles crossing the others' (and, at half the count, its own) go down. Prints the
// garment's REFIT table (garments/<garment>.mjs REFIT[who], lowgarment.mjs applyRefit) with the changes in it.
//
//   node tools/sculpt/lowrefit.mjs --who male|female --garment trousers|tunic|shawl|hood [--keys <regex>]
//       [--extra head,...] [--ban root,...] [--amts 0.2,0.4] [--shifts 0.4] [--sweeps 6] [--self 0.5]
//
// The vertices searched: those of the garment's triangles crossing anything in any sampled frame, and their neighbours,
// whose key (the REFIT table's: trousers `row:column` of the left leg, tunic `row:azimuth`, shawl `ring:azimuth`, hood
// `out:row:column` and the chin patch's) matches --keys; a vertex the builder copies (a turned-in edge, the lining) moves
// with the one it copies. The candidates for a vertex: its weights blended toward one bone (--amts), a share of one of
// its bones moved to another (--shifts; with each neighbour's the same at once), a neighbour's weights; the bones its
// own and its neighbours' weights name and their parents, --extra added, --ban taken out.
//
// Against: the trousers the body, the shawl, the boots and the tunic; the tunic the body, the trousers and the shawl;
// the shawl the body, the trousers, the tunic and the hood; the hood the body, the shawl and the tunic (the hood up).
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildRig } from './lowrig.mjs';
import * as LG from './lowgarment.mjs';
import * as TR from './garments/trousers.mjs';
import * as TU from './garments/tunic.mjs';
import * as SH from './garments/shawl.mjs';
import * as HO from './garments/hood.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const who = opt('who', 'male'), garment = opt('garment', 'tunic'), sweeps = +opt('sweeps', '6'), SELF = +opt('self', '0.5');
const X = { trousers: 'T', tunic: 'U', shawl: 'S', hood: 'H' }[garment];
if (!X) throw new Error(`no garment ${garment}`);
const AMTS = opt('amts', '0.2,0.4').split(',').map(Number), SHIFTS = opt('shifts', '0.4').split(',').map(Number);

// the outfit as the game wears it (garments/outfit1.mjs), the hood round it (garments/hood.mjs)
const rig = buildRig(who);
const T = TR.buildTrousers(rig); T.vw = TR.trousersWeights(rig, T);
const U = TU.buildTunic(rig, undefined, { under: [T] }); U.vw = TU.tunicWeights(rig, U);
const S = SH.buildShawl(rig, undefined, { under: [U] }); S.vw = SH.shawlWeights(rig, S);
const H = HO.buildHood(rig, S, undefined, { under: [U] }); H.vw = HO.hoodWeights(rig, H, S);
const G = { T, U, S, H }[X];
const assets = {
  trousers: { ...LG.garmentAsset(rig, T, TR.MATS), hides: TR.hiddenPolys(rig, T) },
  tunic: { ...LG.garmentAsset(rig, U, TU.MATS), hides: TU.hiddenPolys(rig, U) },
  shawl: LG.garmentAsset(rig, S, SH.MATS),
  hood: LG.garmentAsset(rig, H, HO.MATS),
};
const TMP = `${ROOT}tmp/lowrefit/${process.pid}`;
mkdirSync(TMP, { recursive: true });
for (const [k, A] of Object.entries(assets)) writeFileSync(`${TMP}/low${k}-${who}.json`, JSON.stringify(A));
// the game's path with these garments in place of the committed copies
const plugin = { name: 'refit', setup(b) { b.onResolve({ filter: new RegExp(`assets/low(trousers|tunic|shawl|hood)-${who}\\.json$`) }, (a) => ({ path: `${TMP}/${a.path.split('/').pop()}` })); } };
const bb = await build({
  stdin: { contents: `export { lowScene } from './src/sculpt/lowpoly'; export { CLIPS } from './src/sculpt/anim';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT, plugins: [plugin],
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(bb.outputFiles[0].text).toString('base64'));
const json = (f) => JSON.parse(readFileSync(`${ROOT}src/sculpt/assets/${f}`, 'utf8'));
const body = json(`low${who}.json`), boots = json(`lowboots-${who}.json`);
const hidden = new Set([...assets.trousers.hides, ...boots.hides, ...assets.tunic.hides]);
const n = {
  B: body.tris.filter((_, k) => k % 4 === 3).filter((pi) => !hidden.has(pi)).length, S: assets.shawl.tris.length / 4,
  T: assets.trousers.tris.length / 4, G: boots.tris.length / 4, U: assets.tunic.tris.length / 4, H: assets.hood.tris.length / 4,
};
const ORDER = ['B', 'S', 'T', 'G', 'U', 'H'];
const OTHERS = { T: ['B', 'S', 'G', 'U'], U: ['B', 'T', 'S'], S: ['B', 'T', 'U', 'H'], H: ['B', 'S', 'U'] }[X];
const look = { gender: who === 'male' ? 'man' : 'woman', skin: 'light', hair: 'bald', hairColour: 'brown', eyes: 'brown', beard: 'none', shirt: 'unbleached', trousers: 'walnut' };

/* ---- the crossings --------------------------------------------------------------------------------------------- */
const cell = 0.25, key3 = (x, y, z) => `${x},${y},${z}`;
const boxOf = (A) => [[0, 1, 2].map((j) => Math.min(A[0][j], A[1][j], A[2][j])), [0, 1, 2].map((j) => Math.max(A[0][j], A[1][j], A[2][j]))];
const cells = (A, f) => { const [lo, hi] = boxOf(A); for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++) for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++) for (let z = Math.floor(lo[2] / cell); z <= Math.floor(hi[2] / cell); z++) f(key3(x, y, z)); };
const gridOf = (tris) => { const g = new Map(); tris.forEach((A, i) => cells(A, (k) => (g.get(k) ?? g.set(k, []).get(k)).push(i))); return g; };
function hits(A, tris, grid, skip) {
  const [lo, hi] = boxOf(A), seen = new Set(); let c = 0;
  cells(A, (k) => { for (const j of grid.get(k) ?? []) {
    if (seen.has(j)) continue; seen.add(j);
    if (skip && skip(j)) continue;
    const [l2, h2] = boxOf(tris[j]);
    if (lo[0] > h2[0] || l2[0] > hi[0] || lo[1] > h2[1] || l2[1] > hi[1] || lo[2] > h2[2] || l2[2] > hi[2]) continue;
    if (LG.triTri(A, tris[j])) c++;
  } });
  return c;
}

/* ---- the frames: the walk (16) and the whole idle (24), facing 0, the hood up ---------------------------------- */
const XT = G.tris.map((t) => t.v);
let REST = null;
const posedOf = (Bn, i, w) => { const p = REST[i], q = [0, 0, 0]; for (const [b, x] of w) { const m = b * 12; for (let c = 0; c < 3; c++) q[c] += x * (Bn[m + c * 4] * p[0] + Bn[m + c * 4 + 1] * p[1] + Bn[m + c * 4 + 2] * p[2] + Bn[m + c * 4 + 3]); } return q; };
const PH = [];
for (const [kind, moving, N] of [['walk', true, 16], ['idle', false, 24]]) for (let k = 0; k < N; k++) {
  const phase = moving ? (k / N) * Math.PI * 2 : (k / N) * 6 * TS.CLIPS.idle.length;
  const s = TS.lowScene({ phase, moving, facing: 0, swimming: false, working: false, look, outfit: { hood: true } });
  const V = s.baked.verts, Bn = s.bones, P = [];
  for (let i = 0; i < s.baked.nVerts; i++) { const o = i * 17, p = [V[o], V[o + 1], V[o + 2]], q = [0, 0, 0]; for (let j = 0; j < 4; j++) { const w = V[o + 11 + j]; if (w <= 0) continue; const m = V[o + 7 + j] * 12; for (let c = 0; c < 3; c++) q[c] += w * (Bn[m + c * 4] * p[0] + Bn[m + c * 4 + 1] * p[1] + Bn[m + c * 4 + 2] * p[2] + Bn[m + c * 4 + 3]); } P.push(q); }
  const tri = (t) => [P[s.baked.tris[t * 3]], P[s.baked.tris[t * 3 + 1]], P[s.baked.tris[t * 3 + 2]]];
  let o = 0; const start = {}; for (const x of ORDER) { start[x] = o; o += n[x]; }
  if (o !== s.baked.nTris) throw new Error('the bake is not the body less the hidden and the garments');
  // (the garment's rest vertices as the bake has them: the figure's frame)
  if (!REST) {
    REST = G.verts.map(() => null);
    for (let t = 0; t < n[X]; t++) for (let c = 0; c < 3; c++) { const o2 = s.baked.tris[(start[X] + t) * 3 + c] * 17; REST[XT[t][c]] = [V[o2], V[o2 + 1], V[o2 + 2]]; }
    let d = 0; for (let t = 0; t < n[X]; t++) { const A = tri(start[X] + t); XT[t].forEach((vi, c) => { const q = posedOf(Bn, vi, G.vw[vi]); d = Math.max(d, Math.hypot(q[0] - A[c][0], q[1] - A[c][1], q[2] - A[c][2])); }); }
    if (d > 1e-3) throw new Error(`the garment skinned here differs from the bake by ${d}`);
  }
  const others = OTHERS.flatMap((x) => Array.from({ length: n[x] }, (_, t) => tri(start[x] + t)));
  PH.push({ kind, k, Bn, others, og: gridOf(others) });
}
const incident = G.verts.map(() => []); XT.forEach((t, k) => t.forEach((vi) => incident[vi].push(k)));
const nb = G.verts.map(() => new Set()); for (const t of XT) for (const a of t) for (const b of t) if (a !== b) nb[a].add(b);
const vw = G.vw.map((l) => l.map(([b, w]) => [b, w]));
for (const p of PH) { p.X = G.verts.map((_, i) => (REST[i] ? posedOf(p.Bn, i, vw[i]) : [0, 0, 0])); p.XT = XT.map((t) => t.map((i) => p.X[i])); p.xg = gridOf(p.XT); }
const shares = (k, j) => XT[j].some((q) => XT[k].includes(q));
const triCost = (p, k, A) => hits(A, p.others, p.og) + SELF * hits(A, p.XT, p.xg, (j) => j === k || shares(k, j));
const total = () => { const c = { other: 0, self: 0 }; for (const p of PH) XT.forEach((_, k) => { c.other += hits(p.XT[k], p.others, p.og); c.self += hits(p.XT[k], p.XT, p.xg, (j) => j <= k || shares(k, j)); }); return c; };
console.log(who, garment, 'before', JSON.stringify(total()));

/* ---- the keys, the copies and the mirror ------------------------------------------------------------------------- */
// keyOf: vertex → [key, mirrored] (the REFIT table's key of its left-side twin); copyOf: [vertex, the vertex it copies]
const keyOf = new Map(), copyOf = [], mirV = new Array(G.verts.length).fill(undefined);
if (X === 'T') for (const [s, m] of [['l', false], ['r', true]]) for (const [row, arr] of Object.entries(G.rows.leg[s])) if (Array.isArray(arr)) arr.forEach((v, k) => { if (!keyOf.has(v) || !m) keyOf.set(v, [`${row}:${k}`, m]); mirV[v] = G.rows.leg[m ? 'l' : 'r'][row][k]; });
if (X === 'U') {
  for (const [key, v] of G.keys) {
    const [row, az] = key.split(':');
    if (row === 'L' || row === 'R') { keyOf.set(v, [`L:${key.slice(2)}`, row === 'R']); mirV[v] = G.keys.get(`${row === 'L' ? 'R' : 'L'}:${key.slice(2)}`); }
    else { keyOf.set(v, [`${row}:${Math.abs(+az)}`, +az < 0]); mirV[v] = +az === 0 || +az === 180 ? v : G.keys.get(`${row}:${-az}`); }
  }
  for (const [c, f] of G.copyOf ?? []) copyOf.push([c, f]);
}
if (X === 'S') {
  const N = G.cols.length;
  for (const [ring, arr] of Object.entries(G.rings)) arr.forEach((v, k) => { const d = G.cols[k].deg; keyOf.set(v, [`${ring}:${d <= 180 ? d : 360 - d}`, d > 180]); mirV[v] = arr[(N - k) % N]; });
  for (const [a, b] of [['IT', 'T0'], ['I1', 'T1'], ['I5', 'T5']]) G.rings[a].forEach((v, k) => copyOf.push([v, G.rings[b][k]]));
}
if (X === 'H') {
  for (const h of [0, 1]) G.V.out[h].forEach((r, k) => r.forEach((v, j) => { keyOf.set(v, [`out:${k}:${j}`, h === 1]); mirV[v] = G.V.out[1 - h][k][j]; }));
  for (const h of [0, 1]) G.V.in[h].forEach((r, k) => r.forEach((v, j) => { mirV[v] = G.V.in[1 - h][k][j]; const o = G.V.out[h][k][j]; if (v !== o) copyOf.push([v, o]); }));
  for (const h of [0, 1]) G.line[h].forEach((v, k) => { if (v !== undefined) { copyOf.push([v, G.V.out[h][k][0]]); mirV[v] = G.line[1 - h][k]; } });
  // (the chin patch and the tip lie on the middle line: each its own mirror)
  const mid = [...G.frontC0.S.map((v, k) => [v, `S:${k}`]), ...G.frontC0.L.map((v, k) => [v, `L:${k}`]), [G.frontC0.R, 'R'], ...(G.lr0 !== null ? [[G.lr0, 'lr']] : []), [G.tip, 'tip']];
  for (const [v, key] of mid) { keyOf.set(v, [key, false]); mirV[v] = v; }
  copyOf.push([G.lineApex, G.V.out[0][G.design.Kf][0]], [G.tipIn, G.tip]);
}
const copies = new Map(), copyOfV = new Map();
for (const [c, f] of copyOf) { (copies.get(f) ?? copies.set(f, []).get(f)).push(c); copyOfV.set(c, f); }
const allB = LG.bonesWith(rig, G), bIdx = new Map(allB.map((b, i) => [b.name, i]));
const mirB = allB.map((b) => bIdx.get(b.name.replace(/_(l|r)$/, (_, c) => (c === 'l' ? '_r' : '_l'))) ?? -1);
const mirW = (w) => w.map(([b, x]) => [mirB[b] >= 0 ? mirB[b] : b, x]);

/* ---- the search -------------------------------------------------------------------------------------------------- */
const norm4 = (m) => { const l = [...m].filter(([, w]) => w > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4), s = l.reduce((a, [, w]) => a + w, 0); return l.map(([b, w]) => [b, w / s]); };
const blend = (a, b, t) => { const m = new Map(); for (const [k, w] of a) m.set(k, (m.get(k) ?? 0) + w * (1 - t)); for (const [k, w] of b) m.set(k, (m.get(k) ?? 0) + w * t); return norm4(m); };
const shift = (w, a, b, k) => { const m = new Map(w); const x = (m.get(a) ?? 0) * k; if (!x) return null; m.set(a, m.get(a) - x); m.set(b, (m.get(b) ?? 0) + x); return norm4(m); };
// the region: the vertices of triangles that cross anything, and their neighbours, whose key matches
let region = new Set();
for (const p of PH) XT.forEach((t, k) => { if (triCost(p, k, p.XT[k]) > 0) t.forEach((i) => region.add(i)); });
region = new Set([...region, ...[...region].flatMap((i) => [...nb[i]])]);
const kr = new RegExp(opt('keys', '.'));
region = new Set([...region].filter((i) => { const r = copyOfV.get(i) ?? i; return keyOf.has(r) && kr.test(keyOf.get(r)[0]); }));
// the groups: a vertex with its copies, and its mirror's (one group for the two)
const groups = new Map();
for (const i of region) { const r = copyOfV.get(i) ?? i; if (!groups.has(r)) groups.set(r, [r, ...(copies.get(r) ?? [])]); }
for (const [r, g] of [...groups]) {
  if (!groups.has(r)) continue;
  const m = mirV[r]; if (m === undefined || m === r) continue;
  const mr = copyOfV.get(m) ?? m;
  if (mr !== r) groups.delete(mr);
  g.mirror = [mr, ...(copies.get(mr) ?? [])];
}
const BAN = new Set(opt('ban', 'root').split(',').filter(Boolean).map((x) => rig.at.get(x)));
const EXTRA = opt('extra', '').split(',').filter(Boolean).map((x) => rig.at.get(x));
const parentOf = (b) => (b < rig.bones.length ? rig.bones[b].p ?? -1 : -1);
const allowedOf = (g) => { const s = new Set(EXTRA); for (const i of g) for (const j of [i, ...nb[i]]) for (const [b] of G.vw[j]) { s.add(b); if (parentOf(b) >= 0) s.add(parentOf(b)); } return [...s].filter((b) => b >= 0 && !BAN.has(b)); };
const groupOf = new Map(); for (const [r, g] of groups) for (const i of [...g, ...(g.mirror ?? [])]) groupOf.set(i, r);
const nbGroups = (r) => { const o = new Set(); for (const i of groups.get(r)) for (const j of nb[i]) { const h = groupOf.get(j); if (h !== undefined && h !== r) o.add(h); } return [...o]; };
const setOf = (mv) => { const set = new Map(); for (const [root, w0] of mv) { const g = groups.get(root), w = mirV[root] === root ? blend(w0, mirW(w0), 0.5) : w0; for (const i of g) set.set(i, w); for (const i of g.mirror ?? []) set.set(i, mirW(w)); } return set; };
const trisOf = (set) => [...new Set([...set.keys()].flatMap((i) => incident[i]))];
const costOf = (set, tris) => { let c = 0; for (const p of PH) { const pos = new Map(); for (const [i, w] of set) pos.set(i, posedOf(p.Bn, i, w)); for (const k of tris) c += triCost(p, k, XT[k].map((x) => pos.get(x) ?? p.X[x])); } return c; };
for (let sw = 0; sw < sweeps; sw++) {
  let changed = 0;
  for (const [r, g] of groups) {
    const cur = vw[r], allowed = allowedOf(g), moves = [];
    if (costOf(new Map(), trisOf(setOf([[r, cur]]))) === 0) continue;
    for (const j of nb[r]) if (!g.includes(j)) moves.push([[r, blend(cur, vw[j], 0.5)]], [[r, vw[j]]]);
    for (const b of allowed) for (const a of AMTS) moves.push([[r, blend(cur, [[b, 1]], a)]]);
    const NBG = nbGroups(r);
    for (const [a] of cur) for (const b of allowed) if (b !== a) for (const k of SHIFTS) {
      const w = shift(cur, a, b, k); if (!w) continue;
      moves.push([[r, w]]);
      for (const h of NBG) { const wh = shift(vw[h], a, b, k); if (wh) moves.push([[r, w], [h, wh]]); }
    }
    let best = 0, bm = null;
    for (const mv of moves) { const set = setOf(mv), tris = trisOf(set), d = costOf(set, tris) - costOf(new Map(), tris); if (d < best - 1e-9) { best = d; bm = set; } }
    if (!bm) continue;
    changed++;
    for (const [i, w] of bm) vw[i] = w;
    const tris = trisOf(bm);
    for (const p of PH) { for (const [i, w] of bm) p.X[i] = posedOf(p.Bn, i, w); for (const k of tris) p.XT[k] = XT[k].map((x) => p.X[x]); p.xg = gridOf(p.XT); }
  }
  console.log(who, garment, 'sweep', sw, 'changed', changed, JSON.stringify(total()));
  if (!changed) break;
}
for (const p of PH) { let o = 0; XT.forEach((_, k) => { o += hits(p.XT[k], p.others, p.og); }); if (o) console.log('left', p.kind, p.k, o); }

/* ---- the table --------------------------------------------------------------------------------------------------- */
const r2 = (x) => +x.toFixed(2), name = (b) => allB[b].name;
const table = { ...({ T: TR, U: TU, S: SH, H: HO }[X].REFIT?.[who] ?? {}) };
vw.forEach((w, i) => {
  const a = G.vw[i], same = w.length === a.length && w.every(([b, x]) => Math.abs((a.find(([c]) => c === b)?.[1] ?? -1) - x) < 1e-6);
  if (same || copyOfV.has(i)) return;
  const k = keyOf.get(i);
  if (!k) { console.log('changed but without a key (left as the builder makes it):', i); return; }
  if (k[1]) return;
  table[k[0]] = w.map(([b, x]) => [name(b), r2(x)]).filter(([, x]) => x >= 0.02);
});
console.log(`REFIT.${who} for garments/${garment}.mjs:`);
for (const [k, l] of Object.entries(table)) console.log(`    '${k}': [${l.map(([b, x]) => `['${b}', ${x}]`).join(', ')}],`);
