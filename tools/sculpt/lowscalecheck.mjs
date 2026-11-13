// The scale set (src/sculpt/assets/lowscale<piece>-<who>.json, tools/sculpt/garments/scale*.mjs) held to the game's own
// figure path: lowScene's bake and bones (src/sculpt/lowpoly.ts, bundled for Node), skinned here as the shader skins them,
// as tools/sculpt/lowplatebootscheck.mjs holds the plate boots.
//
//   node tools/sculpt/lowscalecheck.mjs [--who male,female] [--outfit '<FigurePose.gear JSON>'] [--json <file>]
//     with the whole set equipped (or the gear given), both bodies, the hair left off: each worn piece's triangles crossing
//     the body's (less the hidden) and every other piece's, in the idle over its loop (12 moments), the walk (16), a fight
//     (the long sword's overhead swing, every 0.1 s of a two-second go) and work at the bench (the awl, every 0.1 s of a
//     two-second go); the lowest sole on the floor; the materials the draw takes against the renderer's 128.
//   Exits 1 when a piece crosses the body or another piece in the idle or the walk.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { crossPairs } from './lowgarment.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const b = await build({
  stdin: { contents: `export { lowScene, outfitOf } from './src/sculpt/lowpoly'; export { CLIPS } from './src/sculpt/anim'; export { DEFAULT_LOOK } from './src/game/look';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
const json = (f) => JSON.parse(readFileSync(new URL(f, `file://${ROOT}`), 'utf8'));
const gear = JSON.parse(opt('outfit', '{"head":{"id":"scale_helm"},"chest":{"id":"scale_cuirass"},"shawl":{"id":"scale_shawl"},"legs":{"id":"scale_leggings"},"feet":{"id":"scale_boots"}}'));
/** The pieces in the order the game lays them (src/sculpt/lowpoly.ts GARMENTS: the scale set's), by outfit switch. */
const PIECES = [['plateHelm', 'lowhelm'], ['plateLegs', 'lowplatelegs'], ['plateBoots', 'lowplateboots'], ['plateChest', 'lowplatechest'], ['scaleLegs', 'lowscalelegs'], ['scaleBoots', 'lowscaleboots'], ['scaleHelm', 'lowscalehelm'], ['scaleChest', 'lowscalechest']];
/** What leaves a piece's polygons from dropFrom on out (src/sculpt/lowpoly.ts GARMENTS drops). */
const DROPS = { plateBoots: (o) => o.plateLegs || o.scaleLegs, scaleLegs: (o) => o.scaleChest };
const outfit = TS.outfitOf(gear);
let fail = false;
const report = {};
for (const who of opt('who', 'male,female').split(',')) {
  const body = json(`src/sculpt/assets/low${who}.json`), worn = PIECES.filter(([k]) => outfit[k]).map(([k, f]) => [k, json(`src/sculpt/assets/${f}-${who}.json`)]);
  const hidden = new Set(worn.flatMap(([, A]) => A.hides ?? []));
  for (const [piece, parent] of body.split ?? []) if (hidden.has(parent)) hidden.add(piece);
  let nBody = 0;
  for (let t = 3; t < body.tris.length; t += 4) if (!hidden.has(body.tris[t])) nBody++;
  const look = { ...TS.DEFAULT_LOOK, gender: who === 'male' ? 'man' : 'woman', hair: 'none', beard: 'none' };
  const run = (pose) => {
    const s = TS.lowScene({ facing: 0, swimming: false, look, gear: { weapon: { id: 'long_sword' }, ...gear }, ...pose });
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
    // (the bake: the body less the hidden, then each worn piece in turn, then what is held)
    const parts = { body: T.slice(0, nBody) };
    let at = nBody;
    // (a piece's polygons from dropFrom on left out while what drops them is worn: the leggings' under the cuirass)
    for (const [k, A] of worn) { const cut = DROPS[k]?.(outfit) && A.dropFrom !== undefined ? A.dropFrom : Infinity; let n = 0; for (let t = 3; t < A.tris.length; t += 4) if (A.tris[t] < cut) n++; parts[k] = T.slice(at, at + n); at += n; }
    if (process.env.SCALE_DEBUG) console.log('tris', s.baked.nTris, 'laid', at, 'sword', json('src/sculpt/assets/long_sword.json').tris.length / 4);
    const out = {}, names = Object.keys(parts);
    for (let i = 1; i < names.length; i++) for (let j = 0; j < i; j++) {
      const c = crossPairs(P, parts[names[i]], P, parts[names[j]]).length;
      if (c) out[`${names[i]}×${names[j]}`] = c;
    }
    const sole = Math.min(...T.slice(0, at).flatMap((t) => t.v.map((i) => P[i][2])));
    return { out, sole, mats: s.materials.length };
  };
  const r = (report[who] = {});
  const add = (clip, res) => { const R = (r[clip] ??= { worst: {}, frames: 0, crossed: 0, sole: [Infinity, -Infinity], mats: 0 }); R.frames++; if (Object.keys(res.out).length) R.crossed++; for (const [k, n] of Object.entries(res.out)) R.worst[k] = Math.max(R.worst[k] ?? 0, n); R.sole = [Math.min(R.sole[0], res.sole), Math.max(R.sole[1], res.sole)]; R.mats = Math.max(R.mats, res.mats); };
  const idleLen = TS.CLIPS.idle.length;
  for (let k = 0; k < 12; k++) add('idle', run({ phase: (6 * k * idleLen) / 12, moving: false, working: false }));
  for (let k = 0; k < 16; k++) add('walk', run({ phase: (2 * Math.PI * k) / 16, moving: true, working: false }));
  for (let k = 0; k <= 20; k++) add('fight', run({ phase: 0, moving: false, working: true, job: 'attack_creature', act: { t: k * 0.1, length: 2 } }));
  for (let k = 0; k <= 20; k++) add('work', run({ phase: 0, moving: false, working: true, job: 'make_scale_cuirass', act: { t: k * 0.1, length: 2 } }));
  for (const [clip, R] of Object.entries(r)) {
    R.sole = R.sole.map((x) => +x.toFixed(4));
    console.log(who, clip, `${R.crossed}/${R.frames} frames crossing`, JSON.stringify(R.worst), 'sole', R.sole.join('..'), 'materials', R.mats);
    if ((clip === 'idle' || clip === 'walk') && R.crossed) fail = true;
    if (R.mats > 128) fail = true;
  }
}
if (opt('json', null)) writeFileSync(opt('json'), JSON.stringify(report, null, 1));
process.exit(fail ? 1 : 0);
