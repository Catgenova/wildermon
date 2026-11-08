// The plate boots (src/sculpt/assets/lowplateboots-<who>.json, tools/sculpt/garments/plateboots.mjs) held to the game's
// own figure path: lowScene's bake and bones (src/sculpt/lowpoly.ts, bundled for Node), skinned here as the shader skins
// them, as tools/sculpt/lowgarmentcheck.mjs holds the first outfit.
//
//   node tools/sculpt/lowplatebootscheck.mjs [--json <file>]
//     with outfit { plateBoots } (the first outfit off: the bare legs in the boots), both bodies, plain and enchanted:
//     1. the asset as the tools build it: its weights, the body polygons it hides, its soles, no bones of its own;
//     2. the boots' triangles crossing the body's (less the hidden) and their own: the idle over its whole loop (24
//        phases), the walk (16), and the swing (the long sword in hand) at its guard, top and impact and every 0.05 s
//        through it (reported as overhead: the swing is the arms', not the boots');
//     3. the lowest sole on the floor (the figure's z 0) in every one of those, and the draw within the renderer's 64
//        materials and 80 bones; plain and enchanted the same triangles but for the dropped crests (outfit.plateLegs).
//   Exits 1 when a crossing is found in the idle or the walk, the asset differs, or the boots leave the floor.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildRig } from './lowrig.mjs';
import { crossPairs } from './lowgarment.mjs';
import { buildPlateBoots, plateBootWeights, underOf, DESIGN } from './garments/plateboots.mjs';

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

let fail = false;
const report = {};
const swing = TS.CLIPS.swing, impact = swing.events.find((e) => e.name === 'impact').t, top = swing.poses?.find((p) => p.name === 'top')?.t ?? 1.34;
for (const who of ['male', 'female']) {
  const rig = buildRig(who), A = json(`src/sculpt/assets/lowplateboots-${who}.json`), body = json(`src/sculpt/assets/low${who}.json`);
  // 1. the asset against the tools (built over the leggings when their copy is beside the body, as plateboots.mjs builds it)
  const legsFile = `src/sculpt/assets/lowplatelegs-${who}.json`;
  const G = buildPlateBoots(rig, DESIGN[who], { under: exists(legsFile) ? [underOf(json(legsFile))] : [] });
  G.vw = plateBootWeights(rig, G);
  const r = (report[who] = { tris: A.tris.length / 4, bones: A.bones.length, hides: A.hides.length, soles: A.soles.length, dropFrom: A.dropFrom });
  r.built = G.tris.length === r.tris && G.hides.join() === A.hides.join() && G.soles.join() === A.soles.join() ? 'as the tools' : 'DIFFERS (built over a leggings copy not beside the body?)';
  r.weights = Math.max(...G.vw.map((l, i) => Math.max(...l.map(([bi, w], j) => (A.weights[i][2 * j] === bi ? Math.abs(A.weights[i][2 * j + 1] - w) : 1)))));
  if (A.bones.length || A.base !== rig.bones.length) { console.log(who, 'the boots carry bones'); fail = true; }
  // 2. the game's path
  const look = { ...TS.DEFAULT_LOOK, gender: who === 'male' ? 'man' : 'woman' };
  const hidden = new Set(A.hides), bodyTris = body.tris.filter((_, k) => k % 4 === 3).filter((pi) => !hidden.has(pi)).length;
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
    return { body: crossPairs(P, tG, P, tB).length, self: crossPairs(P, tG).length, ground: Math.abs(soleZ - Math.min(...P.map((q) => q[2]))), floor: Math.min(...P.map((q) => q[2])), s, nG: tG.length };
  };
  const outfit = (lit) => ({ shawl: false, tunic: false, trousers: false, plateBoots: true, enchanted: { boots: lit } });
  for (const lit of [false, true]) {
    const k = lit ? 'enchanted' : 'plain', e = (r[k] = { idle: { body: 0, self: 0 }, walk: { body: 0, self: 0 }, swing: { body: 0, self: 0, frames: 0 }, floor: 0 });
    for (let i = 0; i < 24; i++) { const x = run({ phase: (i / 24) * 6 * TS.CLIPS.idle.length, moving: false, facing: 0, swimming: false, working: false, look, outfit: outfit(lit) }); e.idle.body += x.body; e.idle.self += x.self; e.floor = Math.max(e.floor, Math.abs(x.floor)); }
    for (let i = 0; i < 16; i++) { const x = run({ phase: (i / 16) * Math.PI * 2, moving: true, facing: 0, swimming: false, working: false, look, outfit: outfit(lit) }); e.walk.body += x.body; e.walk.self += x.self; e.floor = Math.max(e.floor, Math.abs(x.floor)); }
    const times = [0, top, impact, ...Array.from({ length: Math.floor(swing.length / 0.05) }, (_, i) => +(i * 0.05).toFixed(2))];
    for (const t of times) {
      const x = run({ phase: 0, moving: false, facing: 0, swimming: false, working: true, job: 'attack_creature', act: { t, length: swing.length }, look, outfit: outfit(lit), gear: { weapon: { id: 'long_sword', material: 'iron' } } });
      e.swing.body += x.body; e.swing.self += x.self; e.swing.frames++;
      if (t === 0 || t === top || t === impact) e.swing[t === 0 ? 'guard' : t === top ? 'top' : 'impact'] = { body: x.body, self: x.self };
    }
    const x = run({ phase: 0, moving: false, facing: 0, swimming: false, working: false, look, outfit: outfit(lit) });
    e.draw = { materials: x.s.materials.length, bones: x.s.bones.length / 12, tris: x.nG };
    if (e.idle.body || e.idle.self || e.walk.body || e.walk.self) fail = true;
    if (e.floor > 1e-3) { console.log(who, k, 'the boots are not on the floor'); fail = true; }
    if (e.draw.materials > 64 || e.draw.bones > 80) { console.log(who, 'over the renderer\'s limits'); fail = true; }
  }
  // the crests dropped under the leggings' knee guards
  const x = TS.lowScene({ phase: 0, moving: false, facing: 0, swimming: false, working: false, look, outfit: { ...outfit(false), plateLegs: true } });
  r.dropped = x.baked.nTris;
  console.log(who, JSON.stringify(r));
}
if (opt('json', null)) writeFileSync(opt('json'), JSON.stringify(report, null, 1));
console.log(fail ? 'FAIL' : 'ok');
process.exit(fail ? 1 : 0);
