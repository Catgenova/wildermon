// The plate leggings' game copy held to the tools' (src/sculpt/assets/lowplatelegs-<who>.json against
// tools/sculpt/garments/platelegs.mjs), and their crossings in the game's own figure path (src/sculpt/lowpoly.ts
// lowScene, bundled for Node: the bake and the bones the GPU draws with, skinned here as the shader skins them), with the
// game's clips (src/sculpt/anim): the walk, the idle's whole loop and the two-handed swing (the long sword in hand).
//
//   node tools/sculpt/lowplatelegscheck.mjs [--walk 32] [--idle 24] [--swing 24] [--outfit plate|set]
//     per body and clip: the plates' triangles crossing the body's (less what the leggings hide), the base layer's, and
//     each other's (two plates, or a plate folding on itself); with --outfit set, the plate set's other pieces worn too
//     (whatever of them this branch has), the leggings' crossings with each.
//   Exits 1 when the asset differs from the tools' or a plate crosses anything in a clip.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { buildRig } from './lowrig.mjs';
import { crossPairs } from './lowgarment.mjs';
import { buildWithBase, plateLegsWeights } from './garments/platelegs.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const NW = +opt('walk', '32'), NI = +opt('idle', '24'), NS = +opt('swing', '24');
const ROOT = new URL('../..', import.meta.url).pathname;
const b = await build({
  stdin: { contents: `export { lowScene } from './src/sculpt/lowpoly'; export { CLIPS } from './src/sculpt/anim';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
const json = (f) => JSON.parse(readFileSync(new URL(f, `file://${ROOT}`), 'utf8'));

let fail = false;
const OUTFIT = { shawl: false, trousers: false, boots: false, tunic: false, hood: false, plateLegs: true };
for (const who of ['male', 'female']) {
  const rig = buildRig(who), G = buildWithBase(rig);
  G.vw = plateLegsWeights(rig, G);
  const A = json(`src/sculpt/assets/lowplatelegs-${who}.json`), body = json(`src/sculpt/assets/low${who}.json`);
  const r = { tris: A.tris.length / 4, hides: A.hides.length, bones: A.bones.length };
  // the asset as the tools build it: its triangles, its weights, the polygons it hides
  r.weights = Math.max(...G.vw.map((l, i) => Math.max(...l.map(([bi, w], j) => (A.weights[i][2 * j] === bi ? Math.abs(A.weights[i][2 * j + 1] - w) : 1)))));
  if (A.bones.length || A.base !== rig.bones.length || r.weights > 1e-5 || G.hides.join() !== A.hides.join() || G.tris.length !== r.tris) { console.log(who, 'the asset differs from the tools\''); fail = true; }
  const nPlate = G.tris.filter((t) => G.polys[t.poly].tag !== 'base').length;
  // (the body's triangles as the bake lays them, less the hidden: each one's part)
  const PART = rig.B.tris.filter((t) => !new Set(A.hides).has(t.poly)).map((t) => rig.B.part[t.v[0]]);
  const hidden = new Set(A.hides), bodyTris = body.tris.filter((_, k) => k % 4 === 3).filter((pi) => !hidden.has(pi)).length;
  const look = { gender: who === 'male' ? 'man' : 'woman', skin: 'light', hair: 'bald', hairColour: 'brown', eyes: 'brown', beard: 'none', shirt: 'unbleached', trousers: 'walnut' };
  const swing = TS.CLIPS.swing, idle = TS.CLIPS.idle;
  const runs = [
    ['walk', NW, (k) => ({ phase: (k / NW) * Math.PI * 2, moving: true })],
    // (the idle's loop: the idle clip's time is the phase over six, so its whole loop is six times its length)
    ['idle', NI, (k) => ({ phase: (k / NI) * 6 * idle.length, moving: false })],
    ['swing', NS, (k) => ({ phase: 0, moving: false, working: true, job: 'attack_creature', act: { t: (k / NS) * swing.length, length: swing.length }, gear: { weapon: { id: 'long_sword', material: 'iron', enchanted: false } } })],
  ];
  for (const [kind, n, poseOf] of runs) {
    const c = (r[kind] = { body: 0, base: 0, plates: 0, worst: 0, where: {} });
    for (let k = 0; k < n; k++) {
      const s = TS.lowScene({ facing: 0, swimming: false, working: false, look, outfit: OUTFIT, ...poseOf(k) });
      const V = s.baked.verts, Bn = s.bones, P = [];
      for (let i = 0; i < s.baked.nVerts; i++) {
        const o = i * 17, p = [V[o], V[o + 1], V[o + 2]], q = [0, 0, 0];
        for (let j = 0; j < 4; j++) {
          const w = V[o + 11 + j]; if (w <= 0) continue;
          const m = V[o + 7 + j] * 12;
          for (let d = 0; d < 3; d++) q[d] += w * (Bn[m + d * 4] * p[0] + Bn[m + d * 4 + 1] * p[1] + Bn[m + d * 4 + 2] * p[2] + Bn[m + d * 4 + 3]);
        }
        P.push(q);
      }
      const T = Array.from({ length: s.baked.nTris }, (_, t) => ({ v: [s.baked.tris[t * 3], s.baked.tris[t * 3 + 1], s.baked.tris[t * 3 + 2]] }));
      // (the bake: the body's triangles less the hidden, then the leggings': their plates, then their base layer; then
      // anything else drawn, the sword)
      const tB = T.slice(0, bodyTris), tP = T.slice(bodyTris, bodyTris + nPlate), tU = T.slice(bodyTris + nPlate, bodyTris + r.tris);
      const xb = crossPairs(P, tP, P, tB), xu = crossPairs(P, tP, P, tU), xp = crossPairs(P, tP), x = [xb.length, xu.length, xp.length];
      // (where: each plate against the body's parts, the base layer, the other plates)
      const tag = (i) => G.polys[G.tris[i].poly].tag + (G.verts[G.tris[i].v[0]][0] < 0 ? 'R' : 'L');
      for (const [i, j] of xb) { const key = `${tag(i)}×${PART[j]}`; c.where[key] = (c.where[key] ?? 0) + 1; if (process.env.DEBUG) console.log(kind, k, key, G.polys[G.tris[i].poly].cell, G.tris[i].v.map((v) => G.verts[v].map((x) => x.toFixed(2)).join(',')).join(' ')); }
      for (const [i] of xu) { const key = `${tag(i)}×base`; c.where[key] = (c.where[key] ?? 0) + 1; }
      for (const [i, j] of xp) { const key = [tag(i), tag(j)].sort().join('×'); c.where[key] = (c.where[key] ?? 0) + 1; }
      c.body += x[0]; c.base += x[1]; c.plates += x[2]; c.worst = Math.max(c.worst, x[0] + x[1] + x[2]);
    }
    if (c.body || c.base || c.plates) fail = true;
  }
  console.log(who, JSON.stringify(r));
}
console.log(fail ? 'FAIL' : 'ok');
process.exit(fail ? 1 : 0);
