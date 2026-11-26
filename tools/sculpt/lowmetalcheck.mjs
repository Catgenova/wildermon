// A metal set (or any worn gear) held to the game's own figure path for tearing and clipping: lowScene's bones
// (src/sculpt/lowpoly.ts, bundled for Node), every worn piece's asset and the body skinned here as the shader skins them.
//
//   node tools/sculpt/lowmetalcheck.mjs --set copper [--who male,female] [--gear '<GearLook JSON>'] [--with '<extra gear JSON>']
//     the set worn whole (or the gear given), both bodies, the hair off: each piece's triangles crossing the body's (less
//     what the pieces hide) and every other piece's, in the idle over its loop (12 moments), the walk (16), a fight (the long
//     sword's overhead swing, every 0.1 s of a two-second go) and work at the bench (every 0.1 s); and each piece's longest
//     edge stretched against its rest (tearing: an edge more than STRETCH times its rest length).
//   Exits 1 when a piece crosses the body or another piece in the idle or the walk, or tears anywhere.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { crossPairs } from './lowgarment.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
/** The most an edge may lengthen, mesh units (about 4 cm): more is a tear. */
const STRETCH = 0.3;
const b = await build({
  stdin: { contents: `export { lowScene, outfitOf, lowLoadMetal } from './src/sculpt/lowpoly'; export { CLIPS } from './src/sculpt/anim'; export { DEFAULT_LOOK } from './src/game/look';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
const json = (f) => JSON.parse(readFileSync(new URL(f, `file://${ROOT}`), 'utf8'));
const set = opt('set', 'copper');
const SLOT = { helm: 'head', chest: 'chest', mantle: 'shawl', legs: 'legs', boots: 'feet' };
const ID = { helm: 'helm', chest: 'plate_breastplate', mantle: 'plate_shawl', legs: 'plate_legs', boots: 'plate_boots' };
const pieces = opt('pieces', 'helm,chest,mantle,legs,boots').split(',');
const gear = { ...Object.fromEntries(pieces.map((p) => [SLOT[p], { id: ID[p], material: set }])), ...JSON.parse(opt('with', '{}')) };
await TS.lowLoadMetal(set);
const outfit = TS.outfitOf(gear);
/** Whether a piece's faces from dropFrom on are left out (the leggings' waist under a chest piece). */
const dropped = (piece) => piece === 'legs' && !!(outfit.plateChest || outfit.leatherChest || outfit.chainChest || outfit.scaleChest || outfit.obsidianChest);
let fail = false;
for (const who of opt('who', 'male,female').split(',')) {
  const body = json(`src/sculpt/assets/low${who}.json`);
  const worn = pieces.map((p) => [p, json(`src/sculpt/assets/lowmetal${set}${p}-${who}.json`)]);
  const hidden = new Set(worn.flatMap(([, A]) => A.hides ?? []));
  for (const [piece, parent] of body.split ?? []) if (hidden.has(parent)) hidden.add(piece);
  const look = { ...TS.DEFAULT_LOOK, gender: who === 'male' ? 'man' : 'woman', hair: 'none', beard: 'none' };
  void worn;
  const trisOf = (A, keep = () => true) => { let n = 0; for (let t = 0; t < A.tris.length; t += 4) if (keep(A.tris[t + 3])) n++; return n; };
  let nBody = 0;
  for (let t = 3; t < body.tris.length; t += 4) if (!hidden.has(body.tris[t])) nBody++;
  const counts = worn.map(([p, A]) => trisOf(A, (pi) => !(dropped(p) && A.dropFrom !== undefined && pi >= A.dropFrom)));
  let rest = null;
  const said = new Set();
  // (a bake point's heaviest bone, by name: the body's bones come first in the bake's own order)
  const boneName = (b0, w0, V, i) => { let b = b0, w = w0; for (let j = 1; j < 4; j++) if (V[i * 17 + 11 + j] > w) { w = V[i * 17 + 11 + j]; b = V[i * 17 + 7 + j]; } return body.bones[b]?.name ?? `#${b}`; };
  const run = (pose) => {
    const s = TS.lowScene({ facing: 0, swimming: false, look, gear: { weapon: { id: 'long_sword' }, ...gear }, ...pose });
    // (the bake, skinned as the shader skins it: each point's four bones and weights)
    const V = s.baked.verts, Bn = s.bones, P = [];
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
    if (nBody + counts.reduce((x, y) => x + y, 0) > T.length) throw new Error(`the bake has ${T.length} triangles, not ${nBody} + ${counts.join(' + ')}`);
    const parts = [['body', T.slice(0, nBody)]];
    let at = nBody;
    worn.forEach(([p], k) => { parts.push([p, T.slice(at, at + counts[k])]); at += counts[k]; });
    // (each edge's rest length, from the bake's own rest points)
    if (!rest) rest = parts.map(([, TT]) => TT.map((t) => t.v.map((a, j) => { const c = t.v[(j + 1) % 3]; return Math.hypot(V[a * 17] - V[c * 17], V[a * 17 + 1] - V[c * 17 + 1], V[a * 17 + 2] - V[c * 17 + 2]); })));
    const out = {};
    for (let k = 1; k < parts.length; k++) {
      for (let j = 0; j < k; j++) {
        const pairs = crossPairs(P, parts[k][1], P, parts[j][1]), d = pairs.length;
        if (d) out[`${parts[k][0]}×${parts[j][0]}`] = d;
        // (where: the piece's material and the other's place, for the first frame looked at)
        if (d && process.env.WHERE && !said.has(`${parts[k][0]}×${parts[j][0]}`)) {
          said.add(`${parts[k][0]}×${parts[j][0]}`);
          const A = worn[k - 1][1], hist = new Map();
          for (const [ti, tj] of pairs) {
            const mat = A.mats[A.polys[A.tris[ti * 4 + 3]][1]];
            const vj = parts[j][1][tj].v[0], bone = boneName(V[vj * 17 + 7], V[vj * 17 + 11], V, vj);
            const key = `${mat}@${bone}`; hist.set(key, (hist.get(key) ?? 0) + 1);
          }
          const ex = [...new Set(pairs.slice(0, 60).map(([ti]) => { const v = [0, 1, 2].map((q) => A.tris[ti * 4 + q]); return v.reduce((acc, vi) => acc.map((x, c) => x + A.verts[vi * 3 + c] / 3), [0, 0, 0]).map((x) => x.toFixed(1)).join(','); }))].slice(0, 6);
          console.log('  where', `${parts[k][0]}×${parts[j][0]}`, JSON.stringify([...hist].sort((a, b) => b[1] - a[1]).slice(0, 8)), 'at rest', ex.join(' '));
        }
      }
      let most = 0;
      parts[k][1].forEach((t, ti) => t.v.forEach((a, j) => { const c = t.v[(j + 1) % 3], L = Math.hypot(P[a][0] - P[c][0], P[a][1] - P[c][1], P[a][2] - P[c][2]), r = rest[k][ti][j]; most = Math.max(most, L - r); }));
      out[`${parts[k][0]}:stretch`] = +most.toFixed(2);
    }
    return out;
  };
  const R = {};
  const addR = (clip, res) => {
    const r = (R[clip] ??= { worst: {}, frames: 0, crossed: 0, stretch: {} });
    r.frames++;
    let crossed = false;
    for (const [k, n] of Object.entries(res)) {
      if (k.endsWith(':stretch')) { r.stretch[k.split(':')[0]] = Math.max(r.stretch[k.split(':')[0]] ?? 0, n); continue; }
      crossed = true; r.worst[k] = Math.max(r.worst[k] ?? 0, n);
    }
    if (crossed) r.crossed++;
  };
  const idleLen = TS.CLIPS.idle.length;
  const clips = new Set(opt('clips', 'idle,walk,fight,work').split(','));
  if (clips.has('idle')) for (let k = 0; k < 12; k++) addR('idle', run({ phase: (6 * k * idleLen) / 12, moving: false, working: false }));
  if (clips.has('walk')) for (let k = 0; k < 16; k++) addR('walk', run({ phase: (2 * Math.PI * k) / 16, moving: true, working: false }));
  if (clips.has('fight')) for (let k = 0; k <= 20; k++) addR('fight', run({ phase: 0, moving: false, working: true, job: 'attack_creature', act: { t: k * 0.1, length: 2 } }));
  if (clips.has('work')) for (let k = 0; k <= 20; k++) addR('work', run({ phase: 0, moving: false, working: true, job: 'make_scale_cuirass', act: { t: k * 0.1, length: 2 } }));
  for (const [clip, r] of Object.entries(R)) {
    const torn = Object.entries(r.stretch).filter(([, x]) => x > STRETCH);
    console.log(who, clip.padEnd(5), `${r.crossed}/${r.frames} frames crossing`, JSON.stringify(r.worst), 'stretch', JSON.stringify(r.stretch));
    if ((clip === 'idle' || clip === 'walk') && r.crossed) fail = true;
    if (torn.length) fail = true;
  }
}
process.exit(fail ? 1 : 0);
