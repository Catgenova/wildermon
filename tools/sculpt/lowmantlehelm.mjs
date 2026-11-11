// The fur mantle (garments/mantle.mjs, built here, so --design can try numbers) against the plate helm (another
// checkout's tools/sculpt/garments/helm.mjs, e.g. `git archive origin/sculpt-plate-helm src tools package.json`,
// node_modules linked) with the head turned and nodded as tools/sculpt/lowhelmcheck.mjs turns it: at rest and on the
// game's idle and walk figure poses. Prints each body's crossings per pose, by the mantle's part and the helm's piece.
//
//   node tools/sculpt/lowmantlehelm.mjs --helm <root> [--design '<json over both bodies' DESIGN>'] [--who male]
import { join } from 'node:path';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { buildRig, posed, fromGame, gameRig } from './lowrig.mjs';
import { crossPairs, skinGarment } from './lowgarment.mjs';
import { buildMantle, mantleWeights, DESIGN } from './garments/mantle.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const HROOT = opt('helm', null), over = JSON.parse(opt('design', '{}'));
if (!HROOT) throw new Error('--helm <root> needed');
const { buildHelm, helmWeights } = await import(pathToFileURL(join(HROOT, 'tools/sculpt/garments/helm.mjs')).href);
const HEAD = {
  turn40: { neck_01: [0, 7, 0], neck_02: [0, 7, 0], head: [0, 26, 0] }, turn40r: { neck_01: [0, -7, 0], neck_02: [0, -7, 0], head: [0, -26, 0] },
  turn70: { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] }, nod24: { neck_01: [7, 0, 0], neck_02: [8, 0, 0], head: [9, 0, 0] },
  nod40: { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] }, back20: { neck_01: [-6, 0, 0], neck_02: [-7, 0, 0], head: [-7, 0, 0] },
  turnnod: { neck_01: [8, 7, 0], neck_02: [8, 7, 0], head: [8, 26, 0] },
};
function addEuler(rig, bone, a, e) {
  const M = (x) => (x.length === 9 ? x : posed(rig, { [bone]: x })[rig.at.get(bone)].L);
  const A = M(a), B = M(e), C = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j];
  return C;
}
// (the game's clips, bundled for node: their poses as the rig takes them, as lowmantleshot.mjs does)
const ROOT = new URL('../..', import.meta.url).pathname;
const AN = await import('data:text/javascript;base64,' + Buffer.from((await build({ stdin: { contents: `export { CLIPS } from './src/sculpt/anim'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text).toString('base64'));
function clipPose(rig, name, t) {
  const clip = AN.CLIPS[name], body = rig.who === 'male' ? 'man' : 'woman', sk = AN.lowSkeleton(body);
  const r = AN.clipLocal(sk, clip, t, clip.grip ? AN.lowHeld(body) : undefined), pose = {};
  r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; });
  return pose;
}
const tally = (l) => { const o = {}; for (const k of l) o[k] = (o[k] ?? 0) + 1; return o; };
for (const who of (opt('who', 'male,female')).split(',')) {
  const rig = buildRig(who), M = buildMantle(rig, { ...DESIGN[who], ...over });
  M.vw = mantleWeights(rig, M);
  const H = buildHelm(rig);
  H.vw = helmWeights(rig, H);
  const g = await gameRig(rig, 'tmp/lowmantlehelm');
  const gameAt = (pose) => fromGame(rig, g.bonesOf(g.sculptRig({ facing: 0, swimming: false, moving: false, working: false, look: g.look, ...pose }).rig, g.PROPS, [], g.REST_EXTRAS), g.gRest);
  const base = { rest: {}, idle: gameAt({ phase: 0 }), walk: gameAt({ phase: Math.PI / 2, moving: true }) };
  const out = [];
  let total = 0;
  // (the clips first, finely: the idle every 0.1 s, the walk in 16, the swing in 24; then the head turns)
  const poses = [];
  for (const [name, n] of [['idle', 0], ['walk', 16], ['swing', 24]]) { const L = AN.CLIPS[name].length, k = n || Math.ceil(L / 0.1); for (let i = 0; i < k; i++) poses.push([`${name} ${((i / k) * L).toFixed(2)}`, clipPose(rig, name, (i / k) * L)]); }
  for (const [bn, b0] of Object.entries(base)) for (const [hn, h] of Object.entries({ none: {}, ...HEAD })) {
    const pose = { ...b0 };
    for (const [bone, e] of Object.entries(h)) pose[bone] = pose[bone] ? addEuler(rig, bone, pose[bone], e) : e;
    poses.push([`${bn} ${hn}`, pose]);
  }
  for (const [label, pose] of poses) {
    const f = posed(rig, pose), PM = skinGarment(rig, f, M), PH = skinGarment(rig, f, H);
    const x = crossPairs(PM, M.tris, PH, H.tris);
    total += x.length;
    if (x.length) out.push([label, x.length, tally(x.map(([a, b]) => `${M.polys[M.tris[a].poly].part}${process.env.CLUMP ? "#" + M.polys[M.tris[a].poly].clump : ""}×${H.polys[H.tris[b].poly].piece ?? H.polys[H.tris[b].poly].part ?? '?'}`))]);
  }
  console.log(who, 'total', total);
  // (per clip: its worst key and its sum by part pair; the head turns each)
  const by = {};
  for (const [label, n, t] of out) { const c = label.split(' ')[0], k = /^(rest|idle|walk) [a-z]/.test(label) && !/^\w+ \d/.test(label) ? label : c; const e = (by[k] ??= { max: 0, sum: 0, at: '', parts: {} }); e.sum += n; if (n > e.max) { e.max = n; e.at = label; } for (const [q, m] of Object.entries(t)) e.parts[q] = (e.parts[q] ?? 0) + m; }
  for (const [k, e] of Object.entries(by)) console.log(' ', k, 'max', e.max, `(${e.at})`, 'sum', e.sum, JSON.stringify(e.parts));
}
