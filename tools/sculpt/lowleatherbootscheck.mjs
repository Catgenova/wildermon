// The leather boots (src/sculpt/assets/lowleatherboots-<who>.json, tools/sculpt/garments/leatherboots.mjs) held to the game's
// own figure path: lowScene's bake and bones (src/sculpt/lowpoly.ts, bundled for Node), skinned here as the shader skins
// them, as tools/sculpt/lowgarmentcheck.mjs holds the first outfit.
//
//   node tools/sculpt/lowleatherbootscheck.mjs [--json <file>] [--who male,female] [--legs <dir>]
//     (--legs: also the boots' triangles crossing the leather leggings' (<dir>/lowleatherlegs-<who>.json, laid and skinned as
//     the game lays a garment) in the same idle, walk and swing)
//     with outfit { leatherBoots } (the first outfit off: the bare legs in the boots), both bodies, plain and enchanted:
//     1. the asset as the tools build it: its weights, the body polygons it hides, its soles, no bones of its own;
//     2. the boots' triangles crossing the body's (less the hidden) and their own: the idle over its whole loop (24
//        phases), the walk (16), and the swing (the long sword in hand) at its guard, top and impact and every 0.05 s
//        through it (reported as overhead: the swing is the arms', not the boots');
//     3. the lowest sole on the floor (the figure's z 0) in every one of those, and the draw within the renderer's 64
//        materials and 80 bones.
//   Exits 1 when a crossing is found in the idle or the walk, the asset differs, or the boots leave the floor.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildRig } from './lowrig.mjs';
import { crossPairs } from './lowgarment.mjs';
import { buildLeatherBoots, leatherBootWeights, underOf, DESIGN } from './garments/leatherboots.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const b = await build({
  stdin: { contents: `export { lowScene } from './src/sculpt/lowpoly'; export { CLIPS } from './src/sculpt/anim'; export { DEFAULT_LOOK } from './src/game/look';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
const json = (f) => JSON.parse(readFileSync(new URL(f, `file://${ROOT}`), 'utf8'));
const exists = (f) => { try { readFileSync(new URL(f, `file://${ROOT}`)); return true; } catch { return false; } };

/** The affine map (least squares) taking each pair's first point to its second. */
function affine(pairs) {
  // solve for each output coordinate: [x y z 1] . m = out
  const A = Array.from({ length: 4 }, () => new Array(4).fill(0)), Bm = Array.from({ length: 4 }, () => [0, 0, 0]);
  for (const [p, q] of pairs) { const a = [...p, 1]; for (let i = 0; i < 4; i++) { for (let j = 0; j < 4; j++) A[i][j] += a[i] * a[j]; for (let c = 0; c < 3; c++) Bm[i][c] += a[i] * q[c]; } }
  // (Gauss-Jordan on the normal equations)
  const M = A.map((row, i) => [...row, ...Bm[i]]);
  for (let i = 0; i < 4; i++) { let p = i; for (let r = i + 1; r < 4; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r; [M[i], M[p]] = [M[p], M[i]]; const d = M[i][i]; for (let j = 0; j < 7; j++) M[i][j] /= d; for (let r = 0; r < 4; r++) if (r !== i) { const f = M[r][i]; for (let j = 0; j < 7; j++) M[r][j] -= f * M[i][j]; } }
  return (p) => [0, 1, 2].map((c) => p[0] * M[0][4 + c] + p[1] * M[1][4 + c] + p[2] * M[2][4 + c] + M[3][4 + c]);
}
let fail = false;
const report = {};
const swing = TS.CLIPS.swing, impact = swing.events.find((e) => e.name === 'impact').t, top = swing.poses?.find((p) => p.name === 'top')?.t ?? 1.34;
for (const who of opt('who', 'male,female').split(',')) {
  const rig = buildRig(who), A = json(`src/sculpt/assets/lowleatherboots-${who}.json`), body = json(`src/sculpt/assets/low${who}.json`);
  // 1. the asset against the tools (built over the leggings when their copy is beside the body, as leatherboots.mjs builds it)
  const legsFile = `src/sculpt/assets/lowleatherlegs-${who}.json`, legsArg = opt('legs', null) ? `${opt('legs')}/lowleatherlegs-${who}.json` : null;
  const under = legsArg ? [underOf(JSON.parse(readFileSync(legsArg, 'utf8')))] : exists(legsFile) ? [underOf(json(legsFile))] : [];
  const G = buildLeatherBoots(rig, DESIGN[who], { under });
  G.vw = leatherBootWeights(rig, G);
  const parts = {};
  const LA = opt('legs', null) ? JSON.parse(readFileSync(`${opt('legs')}/lowleatherlegs-${who}.json`, 'utf8')) : null;
  let toFig = null;
  const r = (report[who] = { tris: A.tris.length / 4, bones: A.bones.length, hides: A.hides.length, soles: A.soles.length });
  r.built = G.tris.length === r.tris && G.hides.join() === A.hides.join() && G.soles.join() === A.soles.join() ? 'as the tools' : 'DIFFERS (built over a leggings copy not beside the body?)';
  r.weights = Math.max(...G.vw.map((l, i) => Math.max(...l.map(([bi, w], j) => (A.weights[i][2 * j] === bi ? Math.abs(A.weights[i][2 * j + 1] - w) : 1)))));
  if (A.bones.length || A.base !== rig.bones.length) { console.log(who, 'the boots carry bones'); fail = true; }
  // 2. the game's path
  const look = { ...TS.DEFAULT_LOOK, gender: who === 'male' ? 'man' : 'woman' };
  const hidden = new Set(A.hides), bodyTris = body.tris.filter((_, k) => k % 4 === 3).filter((pi) => !hidden.has(pi)).length;
  let cat = '', lit = false;
  const run = (pose) => {
    const s = TS.lowScene(pose), V = s.baked.verts, Bn = s.bones, P = [];
    for (let i = 0; i < s.baked.nVerts; i++) {
      const o = i * 17, p = [V[o], V[o + 1], V[o + 2]], q = [0, 0, 0];
      for (let j = 0; j < 4; j++) {
        const w = V[o + 11 + j]; if (w <= 0) continue;
        const m = V[o + 7 + j] * 12;
        for (let c = 0; c < 3; c++) q[c] += w * (Bn[m + c * 4] * p[0] + Bn[m + c * 4 + 1] * p[1] + Bn[m + c * 4 + 2] * p[2] + Bn[m + c * 4 + 3]);
      }
      P.push(q);
    }
    const T = Array.from({ length: s.baked.nTris }, (_, t) => ({ v: [s.baked.tris[t * 3], s.baked.tris[t * 3 + 1], s.baked.tris[t * 3 + 2]] }));
    // (the bake: the body less the hidden, the hair, then the boots; the sword after them while it is in hand)
    const nBoot = A.tris.length / 4, tB = T.slice(0, bodyTris);
    const bootAt = T.findIndex((_, t) => t >= bodyTris && s.baked.verts[s.baked.tris[t * 3] * 17 + 6] >= 34);
    const tG = T.slice(bootAt, bootAt + nBoot);
    const soleZ = Math.min(...tG.flatMap((t) => t.v.map((i) => P[i][2])));
    // (--legs: the leather leggings' copy laid as the bake lays a garment, its rest vertices taken to the figure's frame by
    // the map that takes the boots' asset vertices to their baked ones, skinned with the same bones)
    let legs = 0;
    if (LA) {
      if (!toFig) {
        const pairs = []; tG.forEach((t, n) => t.v.forEach((bi, c) => { const ai = A.tris[(n) * 4 + c]; pairs.push([[A.verts[ai * 3], A.verts[ai * 3 + 1], A.verts[ai * 3 + 2]], [V[bi * 17], V[bi * 17 + 1], V[bi * 17 + 2]]]); }));
        toFig = affine(pairs.slice(0, 400));
      }
      const W = LA.weights, LP = [];
      for (let i = 0; i < LA.verts.length / 3; i++) {
        const p = toFig([LA.verts[i * 3], LA.verts[i * 3 + 1], LA.verts[i * 3 + 2]]), q = [0, 0, 0];
        for (let j = 0; j < W[i].length; j += 2) { const w = W[i][j + 1], m = W[i][j] * 12; for (let c = 0; c < 3; c++) q[c] += w * (Bn[m + c * 4] * p[0] + Bn[m + c * 4 + 1] * p[1] + Bn[m + c * 4 + 2] * p[2] + Bn[m + c * 4 + 3]); }
        LP.push(q);
      }
      const LT = []; for (let t = 0; t < LA.tris.length; t += 4) LT.push({ v: [LA.tris[t], LA.tris[t + 1], LA.tris[t + 2]] });
      const lp = crossPairs(P, tG, LP, LT); legs = lp.length;
      if (!lit) for (const [i] of lp) { const a = G.polys[G.tris[i].poly], pk = `${cat} legs: ${G.side[a.v[0]]} ${a.tag}`; parts[pk] = (parts[pk] ?? 0) + 1; }
    }
    // (the boots' own crossings by part and side, from the tools' build: the bake keeps the asset's triangles in order)
    const self = crossPairs(P, tG);
    for (const [i, j] of self) { const a = G.polys[G.tris[i].poly], c = G.polys[G.tris[j].poly], key = [`${G.side[a.v[0]]} ${a.tag}`, `${G.side[c.v[0]]} ${c.tag}`].sort().join(' x '); if (lit) continue; const pk = `${cat}: ${key}`; parts[pk] = (parts[pk] ?? 0) + 1; }
    return { legs, body: crossPairs(P, tG, P, tB).length, self: self.length, ground: Math.abs(soleZ - Math.min(...P.map((q) => q[2]))), floor: Math.min(...P.map((q) => q[2])), s, nG: tG.length };
  };
  const outfit = (lit) => ({ shawl: false, tunic: false, trousers: false, leatherBoots: true, ...(LA || exists(`src/sculpt/assets/lowleatherlegs-${who}.json`) ? { leatherLegs: true } : {}), enchanted: { leatherBoots: lit } });
  for (lit of [false, true]) {
    const k = lit ? 'enchanted' : 'plain', e = (r[k] = { idle: { body: 0, self: 0, legs: 0 }, walk: { body: 0, self: 0, legs: 0 }, swing: { body: 0, self: 0, legs: 0, frames: 0 }, floor: 0 });
    cat = 'idle';
    for (let i = 0; i < 24; i++) { const x = run({ phase: (i / 24) * 6 * TS.CLIPS.idle.length, moving: false, facing: 0, swimming: false, working: false, look, outfit: outfit(lit) }); e.idle.body += x.body; e.idle.self += x.self; e.idle.legs += x.legs; e.floor = Math.max(e.floor, Math.abs(x.floor)); }
    cat = 'walk';
    for (let i = 0; i < 16; i++) { const x = run({ phase: (i / 16) * Math.PI * 2, moving: true, facing: 0, swimming: false, working: false, look, outfit: outfit(lit) }); e.walk.body += x.body; e.walk.self += x.self; e.walk.legs += x.legs; e.floor = Math.max(e.floor, Math.abs(x.floor)); }
    const times = [0, top, impact, ...Array.from({ length: Math.floor(swing.length / 0.05) }, (_, i) => +(i * 0.05).toFixed(2))];
    cat = 'swing';
    for (const t of times) {
      const x = run({ phase: 0, moving: false, facing: 0, swimming: false, working: true, job: 'attack_creature', act: { t, length: swing.length }, look, outfit: outfit(lit), gear: { weapon: { id: 'long_sword', material: 'iron' } } });
      e.swing.body += x.body; e.swing.self += x.self; e.swing.legs += x.legs; e.swing.frames++;
      if (t === 0 || t === top || t === impact) e.swing[t === 0 ? 'guard' : t === top ? 'top' : 'impact'] = { body: x.body, self: x.self, legs: x.legs };
    }
    const x = run({ phase: 0, moving: false, facing: 0, swimming: false, working: false, look, outfit: outfit(lit) });
    e.draw = { materials: x.s.materials.length, bones: x.s.bones.length / 12, tris: x.nG };
    if (e.idle.body || e.idle.self || e.walk.body || e.walk.self || e.idle.legs || e.walk.legs) fail = true;
    if (e.floor > 1e-3) { console.log(who, k, 'the boots are not on the floor'); fail = true; }
    if (e.draw.materials > 64 || e.draw.bones > 80) { console.log(who, 'over the renderer\'s limits'); fail = true; }
  }
  r.selfParts = parts;
  console.log(who, JSON.stringify(r));
}
if (opt('json', null)) writeFileSync(opt('json'), JSON.stringify(report, null, 1));
console.log(fail ? 'FAIL' : 'ok');
process.exit(fail ? 1 : 0);
